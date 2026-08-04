// worker/signup.js
// Serves the standalone signup flow at /signup/ (Step 1) and /signup/onboarding.html
// (Step 2). Worker-served (not a static asset) so we can force X-Robots-Tag: noindex
// on the response — these pages are unlinked and must never be indexed. The Step-1
// site check calls /api/crm/signup/site-check (real DataForSEO traffic estimate).
import INDEX_HTML from "./signup-index.html";
import ONBOARDING_HTML from "./signup-onboarding.html";

const H = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

export function handle({ request }) {
  const url = new URL(request.url);
  const p = url.pathname;
  // Bare /signup -> /signup/ so the page's relative link to onboarding.html resolves.
  if (p === "/signup") return Response.redirect(url.origin + "/signup/", 308);
  if (p === "/signup/onboarding" || p === "/signup/onboarding/" || p === "/signup/onboarding.html") {
    return new Response(ONBOARDING_HTML, { headers: H });
  }
  // Everything else under /signup/ -> Step 1.
  return new Response(INDEX_HTML, { headers: H });
}
