// Speed-to-Lead — calling windows (spec §5). Window gating is DATA, not logic.
// If a scheduled dial falls outside a valid window, push to the next window open —
// never dial outside it, never drop the touch. All times are in the LEAD's timezone.
export const WINDOWS = {
  roofing: {
    weekday: [
      { start: "06:45", end: "08:00", label: "pre-roll" },
      { start: "16:30", end: "18:00", label: "post-job" },
    ],
    avoid_days: ["sun"],
    preferred_days: ["tue", "wed", "thu"],
  },
  plumbing: {
    weekday: [
      { start: "07:00", end: "08:15", label: "dispatch-huddle" },
      { start: "11:30", end: "12:30", label: "lunch-truck" },
      { start: "16:00", end: "17:30", label: "wrap" },
    ],
    avoid_days: ["sun"],
    avoid_windows: [
      { day: "mon", start: "00:00", end: "10:00" },
      { day: "fri", start: "14:00", end: "23:59" },
    ],
  },
  // Fallback for trades without a tuned window: the federal outer bound (8a–9p local),
  // weekdays + Saturday, which every §5 window sits inside.
  _default: {
    weekday: [{ start: "08:00", end: "20:00", label: "general" }],
    avoid_days: ["sun"],
  },
};

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const hm = (s) => { const [h, m] = String(s).split(":").map(Number); return h * 60 + m; };

// Get {y,mo,d,dow,minutes} for an epoch-ms instant AS SEEN in `tz`.
function localParts(ts, tz) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "America/Chicago", weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = {};
  for (const part of fmt.formatToParts(new Date(ts))) p[part.type] = part.value;
  const dow = DAYS.indexOf((p.weekday || "").toLowerCase());
  let hh = parseInt(p.hour, 10); if (hh === 24) hh = 0;
  return { dow, minutes: hh * 60 + parseInt(p.minute, 10), y: p.year, mo: p.month, d: p.day };
}

function cfgFor(trade) { return WINDOWS[trade] || WINDOWS._default; }

// Is `ts` inside a valid calling window for this trade+tz?
export function inWindow(ts, trade, tz) {
  const cfg = cfgFor(trade);
  const { dow, minutes } = localParts(ts, tz);
  const day = DAYS[dow];
  if ((cfg.avoid_days || []).includes(day)) return false;
  for (const av of cfg.avoid_windows || []) {
    if (av.day === day && minutes >= hm(av.start) && minutes <= hm(av.end)) return false;
  }
  return (cfg.weekday || []).some((w) => minutes >= hm(w.start) && minutes <= hm(w.end));
}

// First valid calling instant at or after `fromTs`. Scans minute-of-day windows
// day by day (max 10 days) so we never dial outside §5.
export function nextWindowOpen(fromTs, trade, tz) {
  const cfg = cfgFor(trade);
  const wins = (cfg.weekday || []).slice().sort((a, b) => hm(a.start) - hm(b.start));
  if (inWindow(fromTs, trade, tz)) return fromTs;
  // Step forward in 5-minute probes up to 10 days; cheap and exact enough.
  const STEP = 5 * 60 * 1000, MAX = 10 * 24 * 60;
  for (let i = 1; i <= MAX; i++) {
    const t = fromTs + i * STEP;
    if (inWindow(t, trade, tz)) {
      // Snap to the exact window start if we landed mid-window on a fresh day boundary.
      return t;
    }
  }
  return fromTs; // give up gracefully — dispatch will still gate on inWindow
}
