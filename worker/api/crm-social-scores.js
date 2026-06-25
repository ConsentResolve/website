// Organic social scoring dashboard data — GET /api/crm/social/scores (CRM-gated).
// Reads social/metrics.json from R2, runs each post through the v3 scoring engine,
// returns per-channel creative grades + the creative leaderboard + a GBP slot.
// Forward-compatible: rows currently carry {name,platform,views,likes}; the engine
// scores on whatever signals are present and auto-upgrades as fetch_metrics.py
// emits the richer fields (shares/saves/retention/hook).
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { fromInstagram, fromYouTube, fromFacebook, fromX, fromLinkedIn, fromTikTok, scorePost, gradeFromComposite, scoreGbp } from "../_lib/social-scoring.js";

const R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev";
const CH = { yt: "youtube", ig: "instagram", fb: "facebook", x: "x", li: "linkedin", tk: "tiktok" };
const COVERAGE = { youtube: "FULL", instagram: "FULL", facebook: "FULL", x: "PARTIAL", linkedin: "MINIMAL", tiktok: "MINIMAL" };
const ORDER = ["youtube", "instagram", "facebook", "x", "linkedin", "tiktok"];

function toPost(r) {
  const id = r.name || r.url || "post";
  switch (r.platform) {
    case "ig": return fromInstagram({ postId: id, isVideo: r.isVideo ?? true, reach: r.reach ?? r.views, saved: r.saved, shares: r.shares, likes: r.likes, comments: r.comments, igReelsAvgWatchTimeMs: r.igReelsAvgWatchTimeMs, videoLengthMs: r.videoLengthMs, reelsSkipRatePct: r.reelsSkipRatePct });
    case "fb": return fromFacebook({ postId: id, isVideo: r.isVideo ?? true, reach: r.reach ?? r.views, shares: r.shares, likes: r.likes, comments: r.comments, saves: r.saves, avgWatchMs: r.avgWatchMs, videoLengthMs: r.videoLengthMs });
    case "yt": return fromYouTube({ postId: id, views: r.views, shares: r.shares, likes: r.likes, comments: r.comments, averageViewPercentage: r.averageViewPercentage, retentionAt30sPct: r.retentionAt30sPct, videoThumbnailImpressionsClickRate: r.videoThumbnailImpressionsClickRate });
    case "x": return fromX({ postId: id, isVideo: r.isVideo ?? false, impressionCount: r.impressionCount ?? r.views, bookmarkCount: r.bookmarkCount ?? r.saves, retweetCount: r.retweetCount, quoteCount: r.quoteCount, likeCount: r.likes, replyCount: r.replyCount, videoViewQuartile50Pct: r.videoViewQuartile50Pct });
    case "li": return fromLinkedIn({ postId: id, isVideo: r.isVideo ?? false, impressionsOrViews: r.views, shares: r.shares, likes: r.likes, comments: r.comments });
    case "tk": return fromTikTok({ postId: id, isVideo: r.isVideo ?? true, impressionsOrViews: r.views, shares: r.shares, likes: r.likes, comments: r.comments, fullVideoWatchedRatePct: r.fullVideoWatchedRatePct });
    default: return null;
  }
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);

  let rows = [];
  try { const res = await fetch(`${R2}/social/metrics.json`); if (res.ok) rows = await res.json(); } catch (_) {}

  const scored = [];
  for (const r of rows) {
    const p = toPost(r);
    if (!p) continue;
    const s = scorePost(p);
    scored.push({ ...s, name: r.name || r.url || s.postId, url: r.url || "", views: r.views ?? p.denom ?? 0, likes: r.likes ?? null, platform: p.channel });
  }

  // Per-channel creative summary (avg composite of graded posts → letter grade).
  const channels = ORDER.map((ch) => {
    const all = scored.filter((s) => s.platform === ch);
    const graded = all.filter((s) => s.graded && s.composite != null);
    const avg = graded.length ? Math.round((graded.reduce((a, s) => a + s.composite, 0) / graded.length) * 10) / 10 : null;
    return {
      channel: ch, coverage: COVERAGE[ch],
      posts: all.length, gradedPosts: graded.length,
      avgComposite: avg, grade: avg != null ? gradeFromComposite(avg) : null,
      graduates: graded.filter((s) => s.graduateToPaid).length,
    };
  });

  // Creative leaderboard: graded posts, best first.
  const leaderboard = scored
    .filter((s) => s.graded && s.composite != null)
    .sort((a, b) => b.composite - a.composite)
    .map((s) => ({ name: s.name, platform: s.platform, grade: s.grade, composite: s.composite, coverage: s.coverage, graduate: s.graduateToPaid, views: s.views, likes: s.likes, url: s.url, reason: s.reason }));

  const ungraded = scored.filter((s) => !s.graded).length;

  // GBP scorecard — pending Google Business Profile API approval (separate model).
  const gbp = { available: false, note: "Google Business Profile API not connected yet — action-rate scorecard pends approval." };

  return json({
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    totalPosts: scored.length, gradedPosts: scored.length - ungraded, ungraded,
    channels, leaderboard, gbp,
    note: rows.length ? "Scoring on current signals (views+likes). Coverage upgrades to FULL once fetch_metrics.py captures shares/saves/retention." : "No metrics.json found on R2 yet.",
  }, {}, cors);
}
