import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProtocolScreen } from "@/components/ProtocolScreen";
import { scoringConfig } from "@/lib/scoring-config";

export function generateStaticParams() {
  return scoringConfig.domains.map((_, i) => ({ n: String(i + 1) }));
}

export default async function ProtocolPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  // Protocols are numbered 1–5 in the URL. Earlier builds used domain ids (/protocol/nervous), which
  // saved resume paths and old links may still hold, so those redirect to their number.
  const legacy = scoringConfig.domains.findIndex((d) => d.id === n);
  if (legacy >= 0) redirect(`/protocol/${legacy + 1}`);
  // Domain order is fixed in the static config; the CMS-merged domain is read from context in ProtocolScreen.
  const domain = /^\d+$/.test(n) ? scoringConfig.domains[Number(n) - 1] : undefined;
  if (!domain) notFound();
  return (
    <AppShell>
      <ProtocolScreen domainId={domain.id} />
    </AppShell>
  );
}
