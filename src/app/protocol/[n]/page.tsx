import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProtocolScreen } from "@/components/ProtocolScreen";
import { protocolsConfig } from "@/lib/protocols";

export function generateStaticParams() {
  return protocolsConfig.protocols.map((_, i) => ({ n: String(i + 1) }));
}

export default async function ProtocolPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  // Protocols are numbered 1–5 in the URL. Earlier builds used domain ids (/protocol/nervous), which
  // saved resume paths and old links may still hold, so those redirect to their number.
  const legacy = protocolsConfig.protocols.findIndex((p) => p.id === n || (n === "recovery" && p.id === "mindset"));
  if (legacy >= 0) redirect(`/protocol/${legacy + 1}`);
  // Protocol order is fixed in the static definitions; the CMS-merged protocol is read from context in ProtocolScreen.
  const protocol = /^\d+$/.test(n) ? protocolsConfig.protocols[Number(n) - 1] : undefined;
  if (!protocol) notFound();
  return (
    <AppShell>
      <ProtocolScreen domainId={protocol.id} />
    </AppShell>
  );
}
