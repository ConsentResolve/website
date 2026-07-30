// Speed-to-Lead — sequence definitions (spec §6 Sequence B, §7 Sequence A).
// offset = seconds after lead.created_at. windowed steps get pushed to the next
// §5 calling window. B5 is scheduled relative to the booked meeting (see runner).
const M = 60, H = 3600, D = 86400;

export const SEQUENCE_B = [
  { step: "B1_retell", offset: 45,        channel: "call_ai",    actor: "ai",     template: "B1_retell" },
  { step: "B2_sms",    offset: 3 * M,     channel: "sms",        actor: "system", template: "B2_sms" },
  { step: "B3_email",  offset: 8 * M,     channel: "email",      actor: "system", template: "B3_email" },
  { step: "B4_dial",   offset: 3 * H,     channel: "call_human", actor: "human",  template: "B4_dial", windowed: true, skipIfTransferred: true },
  // B5 (T-1h pre-meeting) is created when a meeting is booked, not on lead create.
];

export const SEQUENCE_A = [
  { step: "A1_email",  offset: 15 * M,          channel: "email",      actor: "system", template: "A1_email" },
  { step: "A2_dial",   offset: 45 * M,          channel: "call_human", actor: "human",  template: "A_dial", windowed: true },
  { step: "A3_email",  offset: 4 * H,           channel: "email",      actor: "system", template: "A3_email" },
  { step: "A4_dial",   offset: 1 * D,           channel: "call_human", actor: "human",  template: "A_dial", windowed: true },
  { step: "A5_email",  offset: 3 * D + 2 * H,   channel: "email",      actor: "system", template: "A5_email" },
  { step: "A6_dial",   offset: 3 * D + 8 * H,   channel: "call_human", actor: "human",  template: "A_dial", windowed: true },
  { step: "A7_email",  offset: 5 * D,           channel: "email",      actor: "system", template: "A7_email" },
  { step: "A8_dial",   offset: 8 * D,           channel: "call_human", actor: "human",  template: "A_dial", windowed: true },
];

// Compressed schedule for the shareable team demo (is_demo leads): the whole B flow
// runs in ~15 min so 3 teammates can watch it start→finish in one sitting. Windows are
// ignored for demo leads (see runner) so nothing waits for a calling window.
export const SEQUENCE_B_DEMO = [
  { step: "B1_retell", offset: 30,       channel: "call_ai",    actor: "ai",     template: "B1_retell" },
  { step: "B2_sms",    offset: 2 * 60,   channel: "sms",        actor: "system", template: "B2_sms" },
  { step: "B3_email",  offset: 4 * 60,   channel: "email",      actor: "system", template: "B3_email" },
  { step: "B4_dial",   offset: 8 * 60,   channel: "call_human", actor: "human",  template: "B4_dial", windowed: true, skipIfTransferred: true },
];
export const SEQUENCE_A_DEMO = [
  { step: "A1_email", offset: 60,       channel: "email",      actor: "system", template: "A1_email" },
  { step: "A2_dial",  offset: 3 * 60,   channel: "call_human", actor: "human",  template: "A_dial", windowed: true },
  { step: "A3_email", offset: 6 * 60,   channel: "email",      actor: "system", template: "A3_email" },
  { step: "A7_email", offset: 12 * 60,  channel: "email",      actor: "system", template: "A7_email" },
];

export function sequenceFor(population, isDemo) {
  if (isDemo) return population === "B" ? SEQUENCE_B_DEMO : SEQUENCE_A_DEMO;
  return population === "B" ? SEQUENCE_B : SEQUENCE_A;
}

// On graduation (A→B via a consent event) we re-enter at B2 — never re-run B1,
// they just spoke with us (spec §7 Graduation).
export const SEQUENCE_B_ON_GRADUATION = SEQUENCE_B.filter((s) => s.step !== "B1_retell");
