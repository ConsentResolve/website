// Tests for the booking Worker's normalization (the create-booking transform's critical bits).
// Run: node worker/api/__tests__/booking.test.js   (pure functions, no Cloudflare runtime needed)
import { normWebsite, normPhoneE164 } from "../booking.js";

let pass = 0, fail = 0;
function eq(got, want, label) {
  if (got === want) { pass++; }
  else { fail++; console.error(`FAIL ${label}\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`); }
}

// ---- website: normalize leniently, only reject empty/whitespace ----
eq(normWebsite("torresroofing.com"), "https://torresroofing.com", "bare domain");
eq(normWebsite("  http://Www.Foo.com/  "), "https://foo.com", "protocol+www+trailing slash+case+space");
eq(normWebsite("https://example.co.uk/"), "https://example.co.uk", "https + multi-part TLD + slash");
eq(normWebsite("acme hvac.com"), "https://acmehvac.com", "internal spaces silently stripped");
eq(normWebsite("WWW.BigCo.COM///"), "https://bigco.com", "uppercase www + multiple trailing slashes");
eq(normWebsite(""), null, "empty -> null");
eq(normWebsite("   "), null, "whitespace -> null");
eq(normWebsite(null), null, "null -> null");

// ---- phone: E.164, +1 default country ----
eq(normPhoneE164("(555) 123-4567"), "+15551234567", "formatted 10-digit");
eq(normPhoneE164("555 123 4567"), "+15551234567", "spaced 10-digit");
eq(normPhoneE164("5551234567"), "+15551234567", "bare 10-digit");
eq(normPhoneE164("1 555 123 4567"), "+15551234567", "leading 1, 11-digit");
eq(normPhoneE164("+44 20 7946 0958"), "+442079460958", "intl passthrough");
eq(normPhoneE164(""), null, "empty -> null");
eq(normPhoneE164(null), null, "null -> null");

console.log(`\nbooking normalization: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
