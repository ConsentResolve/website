// POST /api/visit { dt } — mark visited_sample and return the trade profile so
// the sample page can theme itself to the participant's trade.

import { json } from "../_lib/http.js";
import { getParticipant, updateParticipant, logEvent, nowIso } from "../_lib/db.js";
import { tradeProfile } from "../_lib/trades.js";

export async function onRequestPost({ request, env }) {
  let dt = "";
  try {
    const body = await request.json();
    dt = (body.dt || "").toString();
  } catch {
    /* ignore */
  }

  const profileFor = (trade) => {
    const t = tradeProfile(trade);
    return { key: t.key, label: t.label, biz: t.biz, city: t.city, phone: t.phone, image: t.image, hero: t.hero, services: t.services, reviews: t.reviews };
  };

  const p = await getParticipant(env, dt);
  if (!p) {
    // Unknown/expired token: still theme the page with the default profile.
    return json({ ok: false, profile: profileFor(null) });
  }

  const samplePath = new URL(request.url).pathname.includes("/api/")
    ? env.SAMPLE_PATH || "/demo/sample/"
    : "/demo/sample/";

  // Only advance state forward; don't clobber a later status on a refresh.
  if (p.status === "registered") {
    await updateParticipant(env, p.id, { status: "visited", visited_at: nowIso(), sample_page: samplePath });
    await logEvent(env, p.id, "visited", { sample_page: samplePath });
  }

  return json({ ok: true, profile: profileFor(p.trade), name: p.name });
}
