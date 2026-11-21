export const metadata = { title: "Reconnect your member account | U Score", robots: { index: false } };
export default function MemberSignInError() {
  return <main style={{ maxWidth: 640, margin: "80px auto", padding: 24 }}><h1>Let’s reconnect your member account.</h1>
    <p>Your sign-in link may have expired, or U Score could not connect. Please start again from your member account.</p>
    <p><a href="/auth/member/start">Try member sign-in again →</a></p>
    <p><a href="https://experimentu.joinajenda.com/member/u-score">Return to your member hub →</a></p></main>;
}
