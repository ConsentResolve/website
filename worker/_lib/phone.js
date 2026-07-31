// Normalize a human-entered phone into E.164 (US default). Accepts any format:
// "(713) 384-8985", "713-384-8985", "7133848985", "+1 713 384 8985" → "+17133848985".
// Returns null when there aren't enough digits to be a real number. This is the single
// place phone formatting should happen for any form that reaches the backend.
export function toE164(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const hasPlus = s.startsWith("+");
  const d = s.replace(/[^\d]/g, "");
  if (hasPlus) return d.length >= 8 ? "+" + d : null;   // already international
  if (d.length === 10) return "+1" + d;                 // US 10-digit
  if (d.length === 11 && d[0] === "1") return "+" + d;  // US with leading 1
  if (d.length >= 11) return "+" + d;                   // assume it includes a country code
  return null;                                          // too short to be valid
}
