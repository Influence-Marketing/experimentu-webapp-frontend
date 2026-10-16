"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { scoringConfig } from "@/lib/scoring-config";
import { downloadCsv, rosterCsv } from "@/lib/csv";
import { deleteEntry, loadEntries, updateEntry } from "@/lib/storage";
import type { Entry } from "@/lib/types";
import { useFlow } from "./FlowProvider";

export function AdminRoster() {
  const router = useRouter();
  const { reset, setCurrentEntryId } = useFlow();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  const week8Delta = (entry: Entry) => {
    if (entry.phase !== "week8") return null;
    const baseline = entries.find(
      (e) =>
        e.phase === "baseline" &&
        e.participant.email.toLowerCase() === entry.participant.email.toLowerCase(),
    );
    return baseline ? entry.result.total - baseline.result.total : null;
  };

  return (
    <div>
      <div className="admin-head rise" style={{ "--i": 0 }}>
        <h1>Roster</h1>
        <div className="admin-actions">
          <button
            type="button"
            className="ghost-btn"
            style={{ minHeight: 44, padding: "0 18px", fontSize: "0.82rem" }}
            onClick={() => {
              reset();
              router.push("/");
            }}
          >
            New entry
          </button>
          <button
            type="button"
            className="primary-btn"
            style={{ minHeight: 44, padding: "0 18px", fontSize: "0.82rem" }}
            disabled={!entries.length}
            onClick={() =>
              downloadCsv(
                rosterCsv(entries, scoringConfig),
                `u-score-roster-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            }
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="admin-table-wrap rise" style={{ "--i": 1 }}>
        {entries.length === 0 ? (
          <p className="admin-empty">No entries on this device yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Age</th>
                <th>Session</th>
                <th>Date</th>
                <th>U Score™</th>
                <th>Quintile</th>
                <th>Δ</th>
                <th>Flags</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((entry) => {
                  const delta = week8Delta(entry);
                  return (
                    <tr key={entry.id}>
                      <td className="at-name">
                        <b>{entry.participant.firstName}</b>
                        <span>{entry.participant.email}</span>
                      </td>
                      <td>{entry.participant.age}</td>
                      <td>
                        <button
                          type="button"
                          className={`phase-pill${entry.phase === "week8" ? " week8" : ""}`}
                          title="Toggle baseline / week-8"
                          onClick={() =>
                            setEntries(
                              updateEntry(entry.id, {
                                phase: entry.phase === "baseline" ? "week8" : "baseline",
                              }),
                            )
                          }
                        >
                          {entry.phase === "week8" ? "Week 8" : "Baseline"}
                        </button>
                      </td>
                      <td>{new Date(entry.createdAt).toLocaleDateString()}</td>
                      <td className="at-score">{entry.result.total}</td>
                      <td>{entry.result.quintile.name}</td>
                      <td>{delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta}`}</td>
                      <td>
                        {entry.result.flags.length
                          ? entry.result.flags.map((f) => (
                              <span key={f.flagId} className="flag-dot" title={f.title} />
                            ))
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="row-action"
                          onClick={() => {
                            setCurrentEntryId(entry.id);
                            router.push(`/report/${entry.id}`);
                          }}
                        >
                          Report
                        </button>
                        <button
                          type="button"
                          className="row-action danger"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete ${entry.participant.firstName}’s ${entry.phase} entry? This only affects this device.`,
                              )
                            ) {
                              setEntries(deleteEntry(entry.id));
                            }
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
      <p className="admin-note rise" style={{ "--i": 2 }}>
        Prototype persistence: entries live in this device’s browser only. CSV export simulates the
        sealed-report print pipeline. Fear words are exported for the fear wall — displayed
        anonymously, always.
      </p>
    </div>
  );
}
