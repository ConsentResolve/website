// Per-user profile/settings store for the CRM, keyed by the Google session email
// (the stable identity — a users-table row may not exist for every signed-in person).
// One JSON blob per user: name, title, phone, avatar (data URL), signature, socials.
let _ready = false;
async function ensure(env) {
  if (_ready) return;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS user_settings (
         email TEXT PRIMARY KEY,
         data TEXT NOT NULL DEFAULT '{}',
         updated_at TEXT NOT NULL DEFAULT (datetime('now')))`
    ).run();
  } catch (_) {}
  _ready = true;
}

export async function getUserSettings(env, email) {
  if (!email) return {};
  await ensure(env);
  try {
    const r = await env.DB.prepare("SELECT data FROM user_settings WHERE lower(email)=lower(?)").bind(email).first();
    return r && r.data ? JSON.parse(r.data) : {};
  } catch (_) { return {}; }
}

export async function saveUserSettings(env, email, patch) {
  await ensure(env);
  const cur = await getUserSettings(env, email);
  const next = { ...cur, ...patch };
  // Socials merge field-by-field so a partial save doesn't wipe untouched links.
  if (patch && patch.socials) next.socials = { ...(cur.socials || {}), ...patch.socials };
  await env.DB.prepare(
    `INSERT INTO user_settings (email, data, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(email) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`
  ).bind(email, JSON.stringify(next)).run();
  return next;
}
