import type { LeadFormContent } from "./types";

// Fallback copy for the intake screen, used when the Statamic lead form can't be fetched.
// Mirrors resources/blueprints/forms/lead_form.yaml in the backend.
export const leadFormConfig: LeadFormContent = {
  session: { label: "Session", baselineLabel: "Baseline", week8Label: "Week-8 retest" },
  firstName: { label: "First name", placeholder: "Jen", maxLength: 100 },
  email: {
    label: "Email",
    opt: "for your sealed report",
    placeholder: "you@example.com",
    maxLength: 200,
  },
  age: { label: "Age", placeholder: "52" },
  fearWord: {
    label: "One word",
    opt: "your biggest health fear",
    placeholder: "invisible",
    maxLength: 24,
    note: "Anonymous. Your word joins the fear wall — never with your name on it.",
  },
  marketingOptIn: {
    text: "I agree to receive emails. I can opt out of receiving any of these communications at any time.",
    required: false,
    value: "1",
  },
  dataConsent: {
    text: "I agree to the health data collection.",
    required: true,
    value: "1",
  },
};
