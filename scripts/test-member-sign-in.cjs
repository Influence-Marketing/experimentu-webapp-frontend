const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const realRequire = createRequire(path.join(root, 'package.json'));
const ts = realRequire('typescript');
const app = 'https://uscore.joinajenda.com';

function runtime(overrides = {}) {
  const jar = new Map();
  const calls = [];
  const stores = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v), removeItem: k => m.delete(k) }; };
  const context = vm.createContext({ Buffer, URL, URLSearchParams, Request, Response, Headers, AbortSignal, Date, console,
    process: { env: { NODE_ENV: 'production', USCORE_MEMBER_SSO_ENABLED: 'true', USCORE_APP_ORIGIN: app, NEXT_PUBLIC_API_BASE_URL: 'https://score-api.example.test/', ...overrides.env } },
    fetch: async (...args) => { calls.push(args); return overrides.fetch ? overrides.fetch(...args) : Response.json({}); },
    window: {}, localStorage: stores(), sessionStorage: stores() });
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const requireFrom = id => {
      if (id === 'server-only') return {};
      if (id === 'next/headers') return { cookies: async () => ({ get: name => jar.has(name) ? { value: jar.get(name) } : undefined }) };
      if (id.startsWith('@/')) return load(path.join(root, 'src', id.slice(2) + '.ts'));
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'));
      return realRequire(id);
    };
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context, { filename: file })(requireFrom, module, module.exports);
    return module.exports;
  }
  return { jar, calls, load: file => load(path.join(root, 'src', file)) };
}

test('start binds a random verifier and state to this browser, without credentials in the redirect', async () => {
  const r = runtime();
  const response = await r.load('app/auth/member/start/route.ts').GET();
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, 'https://experimentu.joinajenda.com');
  assert.equal(location.pathname, '/api/uscore/authorize');
  const binding = JSON.parse(response.cookies.get('__Host-uscore-handoff').value);
  assert.equal(location.searchParams.get('state'), binding.state);
  assert.match(binding.verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.match(location.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /Secure/);
  assert.equal(location.searchParams.has('email'), false);
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('callback refuses missing, mismatched and expired browser bindings before any network call', async () => {
  for (const binding of [null, { state: 'b'.repeat(43), verifier: 'v'.repeat(43), expires: Date.now()+60000 },
    { state: 's'.repeat(43), verifier: 'v'.repeat(43), expires: Date.now()-1 }]) {
    const r = runtime();
    if (binding) r.jar.set('__Host-uscore-handoff', JSON.stringify(binding));
    const response = await r.load('app/auth/member/callback/route.ts').GET(new Request(`${app}/auth/member/callback?state=${'s'.repeat(43)}&code=${'c'.repeat(43)}`));
    assert.equal(new URL(response.headers.get('location')).pathname, '/auth/member/error');
    assert.equal(r.calls.length, 0);
  }
});

test('callback exchanges server-side, sets a host-only HttpOnly cookie, and strips the code', async () => {
  const secret = 'a'.repeat(64);
  const r = runtime({ fetch: async () => Response.json({ session_token: secret, expires_at: new Date(Date.now()+3600000).toISOString() }) });
  r.jar.set('__Host-uscore-handoff', JSON.stringify({ state: 's'.repeat(43), verifier: 'v'.repeat(43), expires: Date.now()+60000 }));
  const response = await r.load('app/auth/member/callback/route.ts').GET(new Request(`${app}/auth/member/callback?state=${'s'.repeat(43)}&code=${'c'.repeat(43)}&next=https://evil.example`));
  assert.equal(response.headers.get('location'), `${app}/?member=1`);
  assert.equal(response.cookies.get('__Host-uscore-member').value, secret);
  assert.equal(response.headers.get('set-cookie').includes('Domain='), false);
  assert.equal(String(r.calls[0][0]), 'https://score-api.example.test/api/member/session');
  assert.equal(JSON.parse(r.calls[0][1].body).code_verifier, 'v'.repeat(43));
  assert.equal(response.headers.get('location').includes(secret), false);
});

test('member intake rejects cross-origin requests and missing sessions', async () => {
  const r = runtime();
  const route = r.load('app/api/member/intake/route.ts');
  assert.equal((await route.POST(new Request(`${app}/api/member/intake`, {method:'POST', headers:{origin:'https://evil.example'}, body:'{}'}))).status, 403);
  assert.equal((await route.POST(new Request(`${app}/api/member/intake`, {method:'POST', headers:{origin:app}, body:'{}'}))).status, 401);
  assert.equal(r.calls.length, 0);
});

test('direct visitors can find member sign-in only after the connection is enabled', async () => {
  const enabled = runtime();
  assert.equal((await (await enabled.load('app/api/member/session/route.ts').GET()).json()).sign_in_available, true);
  const disabled = runtime({env:{USCORE_MEMBER_SSO_ENABLED:'false'}});
  assert.equal((await (await disabled.load('app/api/member/session/route.ts').GET()).json()).sign_in_available, false);
  assert.equal(enabled.calls.length + disabled.calls.length, 0);
});

test('server-side member session token is forwarded only to the configured API', async () => {
  const r = runtime({ fetch: async () => Response.json({ success: true }) });
  r.jar.set('__Host-uscore-member', 'b'.repeat(64));
  const response = await r.load('app/api/member/intake/route.ts').POST(new Request(`${app}/api/member/intake`, {method:'POST', headers:{origin:app}, body:'{"age":45}'}));
  assert.equal(response.status, 200);
  assert.equal(r.calls[0][1].headers.Authorization, `Bearer ${'b'.repeat(64)}`);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('new members must make their own consent choices; caches do not cross accounts', () => {
  const r = runtime();
  const { memberFlow } = r.load('lib/member-session.ts');
  const storage = r.load('lib/storage.ts');
  const own = memberFlow({member:{id:'alice',email:'alice@example.test',name:'Alice Reed'},lead:null,forms:{}}, []);
  assert.equal(own.participant.email, 'alice@example.test');
  assert.equal(own.participant.marketingOptIn, false);
  assert.equal(own.participant.dataConsent, false);
  storage.setMemberStorageScope('alice'); storage.saveFlow(own);
  storage.setMemberStorageScope('bob'); assert.equal(storage.loadFlow().participant.email, '');
  storage.setMemberStorageScope(null); assert.equal(storage.loadFlow().participant.email, '');
  storage.setMemberStorageScope('alice'); assert.equal(storage.loadFlow().participant.email, 'alice@example.test');
});

test('an existing member resumes their server assessment at its first unfinished protocol', () => {
  const r = runtime();
  const { memberFlow } = r.load('lib/member-session.ts');
  const protocols = [1,2].map(n => ({id:n===1?'nervous':'movement',form:{handle:`protocol_${n}`},groups:[{fields:[{handle:'reading',kind:'number'}]}]}));
  const own = memberFlow({member:{id:'alice',email:'alice@example.test',name:'Alice'},
    lead:{token:'a'.repeat(64),participant_id:12,submitted_at:'2026-11-20T10:00:00Z',values:{age:45,sex:'F',data_consent:true,first_name:'Alice'}},
    forms:{protocol_1:{updated_at:'2026-11-20T10:01:00Z',values:{reading:55}},protocol_2:null}}, protocols);
  assert.equal(own.participantId, 12);
  assert.equal(own.inputs.nervous.reading, 55);
  assert.equal(own.resumePath, '/protocol/2');
});
