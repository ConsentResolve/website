// GET /api/status?dt=TOKEN — progress poll for the confirmation screen.

import { json } from "../_lib/http.js";
import { getParticipant } from "../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const dt = new URL(request.url).searchParams.get("dt") || "";
  const p = await getParticipant(env, dt);
  if (!p) return json({ status: "unknown" }, { status: 404 });
  return json({
    status: p.status,
    trade: p.trade,
    visited_at: p.visited_at,
    consented_at: p.consented_at,
    emailed_at: p.emailed_at,
    enrolled_at: p.enrolled_at,
  });
}
