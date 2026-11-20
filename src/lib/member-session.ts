import { fromProtocolValues } from "./fields";
import { emptyFlow } from "./storage";
import { LEAD_FORM, type ProtocolSubmissionValues } from "./api/statamic";
import type { FlowState, Protocol } from "./types";

export type PortalMember = { id: string; email: string; name: string };
export type MemberSessionPayload = {
  member: PortalMember;
  lead: null | { token: string; participant_id: number; submitted_at: string; values: Record<string, unknown> };
  forms: Record<string, null | { updated_at: string; values: ProtocolSubmissionValues }>;
};

/** Restore only this verified identity's server data, never another guest's device cache. */
export function memberFlow(session: MemberSessionPayload, protocols: Protocol[]): FlowState {
  const next = emptyFlow();
  next.participant.firstName = session.member.name.trim().split(/\s+/)[0] || "";
  next.participant.email = session.member.email;
  if (!session.lead) return next;
  const values = session.lead.values;
  next.participant = { ...next.participant,
    firstName: typeof values.first_name === "string" ? values.first_name : next.participant.firstName,
    age: typeof values.age === "number" ? values.age : Number(values.age) || null,
    sex: values.sex === "F" || values.sex === "M" ? values.sex : null,
    fearWord: typeof values.one_word === "string" ? values.one_word : "",
    marketingOptIn: values.promotional_email_agreement === true || values.promotional_email_agreement === 1 || values.promotional_email_agreement === "1",
    dataConsent: values.data_consent === true || values.data_consent === 1 || values.data_consent === "1",
  };
  next.authToken = session.lead.token;
  next.participantId = session.lead.participant_id;
  const startedAt = session.lead.submitted_at;
  next.submissions[LEAD_FORM] = { key: "member-intake", submittedAt: startedAt };
  let firstMissing: number | null = null;
  protocols.forEach((protocol, index) => {
    const saved = session.forms?.[protocol.form.handle];
    if (saved) {
      next.inputs[protocol.id] = fromProtocolValues(protocol, saved.values);
      next.submissions[protocol.form.handle] = { key: JSON.stringify(saved.values), submittedAt: saved.updated_at };
    }
    if ((!saved || saved.updated_at <= startedAt) && firstMissing === null) firstMissing = index + 1;
  });
  next.resumePath = firstMissing === null ? "/result" : `/protocol/${firstMissing}`;
  return next;
}
