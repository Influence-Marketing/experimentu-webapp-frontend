import { protocolsConfig } from "./protocols";
import type { Entry, ProtocolsConfig } from "./types";

function csvCell(value: unknown) {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The device's local entries, one row each: the guest, the total and each area's points and readings. */
export function rosterCsv(entries: Entry[], config: ProtocolsConfig = protocolsConfig) {
  const areaCols = config.protocols.flatMap((p) => [`${p.shortMetric} points`, `${p.shortMetric} readings`]);
  const header = [
    "id",
    "phase",
    "created",
    "first name",
    "email",
    "age",
    "sex",
    "fear word",
    "U Score",
    "out of",
    "word",
    "flags",
    ...areaCols,
  ];
  const rows = entries.map((entry) => {
    const byKey = Object.fromEntries((entry.result?.areas ?? []).map((a) => [a.key, a]));
    const areas = config.protocols.flatMap((p) => {
      const area = byKey[p.id];
      if (!area) return ["", ""];
      return [
        area.points ?? `not scored: ${area.notScored ?? ""}`,
        area.components.map((c) => `${c.measure} ${c.value} (${c.label})`).join("; "),
      ];
    });
    return [
      entry.id,
      entry.phase,
      entry.createdAt,
      entry.participant.firstName,
      entry.participant.email,
      entry.participant.age,
      entry.participant.sex,
      entry.participant.fearWord,
      entry.result?.total ?? "",
      entry.result?.outOf ?? "",
      entry.result?.word ?? "",
      (entry.result?.flags ?? []).map((f) => f.id).join("; "),
      ...areas,
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
