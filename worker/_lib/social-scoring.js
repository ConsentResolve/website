/* Organic Social Scoring Engine (v3 spec) — ported to plain JS for the Worker.
 * Source of truth: docs/title-strategy.md's sibling spec organic-social-dashboard-spec.md.
 * Pull raw API metrics -> adapter normalizes -> scorePost() returns letter grade +
 * coverage tag + graduation flag. Adapters tolerate missing fields (fallback
 * reweighting), so the dashboard works on partial data and upgrades as the
 * fetcher captures more signals. Bands tagged [CALIBRATE] are starting points. */

const clampPct = (n) => Math.max(0, Math.min(100, n));

// ── Adapters: raw per-channel API fields -> NormalizedPost ──────────────────
export function fromInstagram(r) {
  const hold = r.isVideo && r.igReelsAvgWatchTimeMs && r.videoLengthMs
    ? clampPct((r.igReelsAvgWatchTimeMs / r.videoLengthMs) * 100) : undefined;
  const hook = r.isVideo && r.reelsSkipRatePct != null
    ? clampPct(100 - r.reelsSkipRatePct) : undefined; // low skip = strong hook
  return {
    channel: "instagram", postId: r.postId, isVideo: !!r.isVideo,
    denomType: "reach", denom: r.reach, shares: r.shares, saves: r.saved,
    holdRatePct: hold, hookPct: hook,
    engagementCount: (r.likes || 0) + (r.comments || 0) + (r.saved || 0) + (r.shares || 0),
    coverage: "FULL",
  };
}

export function fromYouTube(r) {
  const hook = r.retentionAt30sPct != null ? clampPct(r.retentionAt30sPct)
    : r.videoThumbnailImpressionsClickRate != null ? clampPct(r.videoThumbnailImpressionsClickRate)
    : undefined;
  return {
    channel: "youtube", postId: r.postId, isVideo: true,
    denomType: "views", denom: r.views, shares: r.shares, saves: undefined,
    holdRatePct: r.averageViewPercentage != null ? clampPct(r.averageViewPercentage) : undefined,
    hookPct: hook,
    engagementCount: (r.likes || 0) + (r.comments || 0) + (r.shares || 0),
    coverage: "FULL",
  };
}

export function fromFacebook(r) {
  const hold = r.isVideo && r.avgWatchMs && r.videoLengthMs
    ? clampPct((r.avgWatchMs / r.videoLengthMs) * 100) : undefined;
  return {
    channel: "facebook", postId: r.postId, isVideo: !!r.isVideo,
    denomType: "reach", denom: r.reach, shares: r.shares, saves: r.saves,
    holdRatePct: hold, hookPct: undefined,
    engagementCount: (r.likes || 0) + (r.comments || 0) + (r.saves || 0) + (r.shares || 0),
    coverage: "FULL",
  };
}

export function fromX(r) {
  return {
    channel: "x", postId: r.postId, isVideo: !!r.isVideo,
    denomType: "impressions", denom: r.impressionCount,
    shares: (r.retweetCount || 0) + (r.quoteCount || 0), saves: r.bookmarkCount,
    holdRatePct: undefined, hookPct: r.videoViewQuartile50Pct,
    engagementCount: (r.likeCount || 0) + (r.replyCount || 0) + (r.retweetCount || 0) + (r.quoteCount || 0) + (r.bookmarkCount || 0),
    coverage: "PARTIAL",
  };
}

export function fromLinkedIn(r) {
  return {
    channel: "linkedin", postId: r.postId, isVideo: !!r.isVideo,
    denomType: "impressions", denom: r.impressionsOrViews, shares: r.shares,
    saves: undefined, holdRatePct: undefined, hookPct: undefined,
    engagementCount: (r.likes || 0) + (r.comments || 0) + (r.shares || 0),
    coverage: "MINIMAL",
  };
}

export function fromTikTok(r) {
  const hasRetention = r.fullVideoWatchedRatePct != null;
  return {
    channel: "tiktok", postId: r.postId, isVideo: !!r.isVideo,
    denomType: "views", denom: r.impressionsOrViews, shares: r.shares, saves: undefined,
    holdRatePct: hasRetention ? clampPct(r.fullVideoWatchedRatePct) : undefined,
    hookPct: undefined,
    engagementCount: (r.likes || 0) + (r.comments || 0) + (r.shares || 0),
    coverage: hasRetention ? "PARTIAL" : "MINIMAL",
  };
}

// ── Config: floors, weights, bands ([CALIBRATE] with your trailing medians) ──
export const FLOORS = { reach: 500, impressions: 900, views: 900 };

const WEIGHTS_VIDEO = { share: 0.30, save: 0.25, hold: 0.20, hook: 0.15, eng: 0.10 };
const WEIGHTS_STATIC = { share: 0.40, save: 0.35, eng: 0.25 };

const RATE_BANDS = {
  reach: {
    share: { weak: 0.003, ok: 0.007, good: 0.015 },
    save: { weak: 0.005, ok: 0.010, good: 0.020 },
    eng: { weak: 0.020, ok: 0.040, good: 0.070 },
  },
  impressions: {
    share: { weak: 0.0015, ok: 0.0035, good: 0.0075 },
    save: { weak: 0.0025, ok: 0.0050, good: 0.0100 },
    eng: { weak: 0.0100, ok: 0.0200, good: 0.0350 },
  },
  views: {
    share: { weak: 0.0010, ok: 0.0025, good: 0.0060 },
    save: { weak: 0.0020, ok: 0.0040, good: 0.0080 },
    eng: { weak: 0.0080, ok: 0.0180, good: 0.0320 },
  },
};

const PCT_BANDS = {
  instagram: { hold: { weak: 25, ok: 40, good: 60 }, hook: { weak: 45, ok: 60, good: 75 } },
  facebook: { hold: { weak: 25, ok: 40, good: 60 }, hook: { weak: 0, ok: 0, good: 0 } },
  youtube: { hold: { weak: 35, ok: 50, good: 65 }, hook: { weak: 50, ok: 65, good: 80 } },
  x: { hold: { weak: 0, ok: 0, good: 0 }, hook: { weak: 20, ok: 35, good: 50 } },
  tiktok: { hold: { weak: 20, ok: 35, good: 55 }, hook: { weak: 0, ok: 0, good: 0 } },
};

// ── Scoring math (stable) ────────────────────────────────────────────────────
const POINTS = { excellent: 100, good: 80, ok: 60, weak: 35 };

function bandToPoints(value, b) {
  if (value > b.good) return POINTS.excellent;
  if (value > b.ok) return POINTS.good;
  if (value > b.weak) return POINTS.ok;
  return POINTS.weak;
}

export function gradeFromComposite(c) {
  if (c >= 90) return "A";
  if (c >= 80) return "B";
  if (c >= 70) return "C";
  if (c >= 60) return "D";
  return "F";
}

export function scorePost(p) {
  const floor = FLOORS[p.denomType];
  if (!p.denom || p.denom < floor) {
    return { channel: p.channel, postId: p.postId, graded: false, composite: null,
      grade: null, coverage: p.coverage, metricPoints: {}, graduateToPaid: false,
      reason: `Below ${p.denomType} floor (${p.denom || 0} < ${floor}) — not graded` };
  }
  const rb = RATE_BANDS[p.denomType];
  const pb = PCT_BANDS[p.channel];
  const pts = {};
  const w = p.isVideo ? WEIGHTS_VIDEO : WEIGHTS_STATIC;
  const used = {};

  const shareRate = p.shares != null ? p.shares / p.denom : undefined;
  if (shareRate != null) { pts.share = bandToPoints(shareRate, rb.share); used.share = w.share; }
  const saveRate = p.saves != null ? p.saves / p.denom : undefined;
  if (saveRate != null && "save" in w) { pts.save = bandToPoints(saveRate, rb.save); used.save = w.save; }
  const engRate = p.engagementCount != null ? p.engagementCount / p.denom : undefined;
  if (engRate != null) { pts.eng = bandToPoints(engRate, rb.eng); used.eng = w.eng; }

  if (p.isVideo && pb) {
    if (p.holdRatePct != null && pb.hold.good > 0) { pts.hold = bandToPoints(p.holdRatePct, pb.hold); used.hold = w.hold; }
    if (p.hookPct != null && pb.hook.good > 0) { pts.hook = bandToPoints(p.hookPct, pb.hook); used.hook = w.hook; }
  }

  const totalW = Object.values(used).reduce((a, b) => a + b, 0);
  if (totalW === 0) {
    return { channel: p.channel, postId: p.postId, graded: false, composite: null,
      grade: null, coverage: p.coverage, metricPoints: pts, graduateToPaid: false,
      reason: "No scorable metrics present" };
  }
  let composite = 0;
  for (const k of Object.keys(used)) composite += pts[k] * (used[k] / totalW);
  composite = Math.round(composite * 10) / 10;
  const grade = gradeFromComposite(composite);

  const shareGood = shareRate != null && shareRate > rb.share.ok;
  const graduate = composite >= 80 && shareGood && p.coverage !== "MINIMAL";
  const reason = graduate ? "GRADUATE: B+ with strong shares and retention-backed coverage"
    : p.coverage === "MINIMAL" && composite >= 80 ? "Strong score but MINIMAL coverage — verify natively or paid-probe before graduating"
    : `Grade ${grade} (${composite})`;

  return { channel: p.channel, postId: p.postId, graded: true, composite, grade,
    coverage: p.coverage, metricPoints: pts, graduateToPaid: graduate, reason };
}

// ── Channel warm-up (weekly, vs your own trajectory) ─────────────────────────
const TREND_POINTS = { declining: 35, flat: 60, steady: 80, accelerating: 100 };

export function scoreWarmup(w) {
  const hasNFR = w.nonFollowerReachPct != null;
  const parts = [];
  if (hasNFR) {
    const v = w.nonFollowerReachPct;
    parts.push([v > 70 ? 100 : v > 55 ? 80 : v > 40 ? 60 : 35, 0.40]);
  }
  if (w.followConversionRate != null) {
    const v = w.followConversionRate;
    parts.push([v > 0.02 ? 100 : v > 0.01 ? 80 : v > 0.005 ? 60 : 35, hasNFR ? 0.35 : 0.45]);
  }
  parts.push([TREND_POINTS[w.followerGrowthTrend] || 60, hasNFR ? 0.25 : 0.30]);
  if (!hasNFR && w.distributionGrowthTrend) parts.push([TREND_POINTS[w.distributionGrowthTrend] || 60, 0.25]);
  const totalW = parts.reduce((a, x) => a + x[1], 0);
  const composite = Math.round((parts.reduce((a, x) => a + x[0] * x[1], 0) / totalW) * 10) / 10;
  return { composite, grade: gradeFromComposite(composite) };
}

// ── Google Business Profile — separate discovery→action scorecard ────────────
export function scoreGbp(g) {
  const actions = (g.calls || 0) + (g.directionRequests || 0) + (g.websiteClicks || 0) + (g.messages || 0) + (g.bookings || 0);
  const actionRate = g.views > 0 ? actions / g.views : 0;
  const ratio = g.trailingMedianActionRate > 0 ? actionRate / g.trailingMedianActionRate : 1;
  let grade;
  if (ratio >= 1.25 && g.viewsTrend !== "down") grade = "A";
  else if (ratio >= 1.10) grade = "B";
  else if (ratio >= 0.90) grade = "C";
  else if (ratio >= 0.75) grade = "D";
  else grade = "F";
  return { actionRate: Math.round(actionRate * 1000) / 1000, grade,
    note: `Action rate ${(actionRate * 100).toFixed(1)}% vs median ${(g.trailingMedianActionRate * 100).toFixed(1)}% (views ${g.viewsTrend})` };
}
