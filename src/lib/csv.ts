import { scoringConfig } from "./scoring-config";
import type { Entry, ScoringConfig } from "./types";

function csvCell(value: unknown) {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rosterCsv(entries: Entry[], config: ScoringConfig = scoringConfig) {
  const metricCols = config.domains.flatMap((d) => [`${d.shortMetric} value`, `${d.shortMetric} points`]);
  const upgradeCols = config.domains.filter((d) => d.upgrade).map((d) => d.upgrade!.label);
  const header = [
    "id",
    "phase",
    "created",
    "first name",
    "email",
    "age",
    "fear word",
    "U Score",
    "quintile",
    "flags",
    ...metricCols,
    ...upgradeCols,
  ];
  const rows = entries.map((entry) => {
    const byId = Object.fromEntries(entry.result.domains.map((d) => [d.id, d]));
    const metrics = config.domains.flatMap((d) => {
      const scored = byId[d.id] || {};
      return [scored.value ?? "", scored.points ?? ""];
    });
    const upgrades = config.domains
      .filter((d) => d.upgrade)
      .map((d) => entry.upgrades?.[d.upgrade!.key] ?? "");
    return [
      entry.id,
      entry.phase,
      entry.createdAt,
      entry.participant.firstName,
      entry.participant.email,
      entry.participant.age,
      entry.participant.fearWord,
      entry.result.total,
      entry.result.quintile.name,
      entry.result.flags.map((f) => f.flagId).join("; "),
      ...metrics,
      ...upgrades,
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadCsv(contents: string, filename: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
