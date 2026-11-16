import { RetestEntry } from "@/components/RetestEntry";

// The Week-8 retest link with its token in the path; the same screen as /retest?token=….
export default async function RetestTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RetestEntry token={token} />;
}
