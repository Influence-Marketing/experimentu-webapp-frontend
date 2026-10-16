import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProtocolScreen } from "@/components/ProtocolScreen";
import { scoringConfig } from "@/lib/scoring-config";
import type { DomainId } from "@/lib/types";

export function generateStaticParams() {
  return scoringConfig.domains.map((d) => ({ id: d.id }));
}

export default async function ProtocolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const domain = scoringConfig.domains.find((d) => d.id === (id as DomainId));
  if (!domain) notFound();
  return (
    <AppShell>
      <ProtocolScreen domain={domain} />
    </AppShell>
  );
}
