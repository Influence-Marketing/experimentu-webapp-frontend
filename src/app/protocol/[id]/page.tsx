import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProtocolScreen } from "@/components/ProtocolScreen";
import { protocolsConfig } from "@/lib/protocols";

export function generateStaticParams() {
  return protocolsConfig.protocols.map((p) => ({ id: p.id }));
}

export default async function ProtocolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Protocol ids are fixed scoring keys; the CMS-merged protocol is read from context in ProtocolScreen.
  const protocol = protocolsConfig.protocols.find((p) => p.id === id);
  if (!protocol) notFound();
  return (
    <AppShell>
      <ProtocolScreen domainId={protocol.id} />
    </AppShell>
  );
}
