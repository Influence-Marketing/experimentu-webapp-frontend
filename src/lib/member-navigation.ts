const RETEST_TOKEN = /^[A-Za-z0-9_-]{64}$/;

/** Only an existing personal retest path may survive member sign-in. */
export function safeMemberReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/retest/")) return "/";
  const token = value.slice("/retest/".length);
  return token.length === 64 && RETEST_TOKEN.test(token) ? "/retest/" + token : "/";
}

export function memberSignInHref(retestToken?: string | null): string {
  const path = safeMemberReturnPath(retestToken ? "/retest/" + retestToken : null);
  return path === "/" ? "/auth/member/start" : "/auth/member/start?return_to=" + encodeURIComponent(path);
}
