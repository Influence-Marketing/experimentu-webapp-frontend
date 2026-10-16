import "./gate.css";

export const metadata = {
  title: "Experiment U™ — Private preview",
  robots: { index: false, follow: false },
};

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="gate">
      <span className="glyph">U.</span>
      <h1>Private preview</h1>
      <p>This prototype is for the Experiment U™ team. Enter the passphrase to continue.</p>
      <form method="POST" action="/api/gate">
        <label htmlFor="pw">Passphrase</label>
        <input
          id="pw"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
        />
        <button type="submit">Enter the experiment</button>
      </form>
      <p className="err">{error ? "That passphrase isn’t right." : ""}</p>
      <p className="foot">Experiment U™ · Prototype · Not a medical device</p>
    </main>
  );
}
