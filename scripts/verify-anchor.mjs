#!/usr/bin/env node
/**
 * verify-anchor — proves Shunt's off-ramp is "pluggable, not hard-wired" by
 * running real SEP-1 discovery against ANY anchor's home domain (the same first
 * step web/src/lib/anchor.ts does before SEP-10/SEP-24). It fetches the anchor's
 * stellar.toml and prints the endpoints Shunt would use — no funds, no keys,
 * read-only.
 *
 *   node scripts/verify-anchor.mjs                      # SDF test anchor (testnet default)
 *   node scripts/verify-anchor.mjs stellar.moneygram.com  # live APAC corridor (mainnet)
 *   node scripts/verify-anchor.mjs <any-anchor-domain>
 *
 * The point: swapping the production corridor is exactly one value
 * (VITE_ANCHOR_HOME_DOMAIN) — this script resolves it end to end.
 */
const domain = process.argv[2] || "testanchor.stellar.org";
const url = `https://${domain}/.well-known/stellar.toml`;

function grab(toml, key) {
  const m = toml.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, "im"));
  return m ? m[1] : null;
}

const res = await fetch(url, { headers: { "user-agent": "shunt-verify-anchor/1.0" } });
if (!res.ok) {
  console.error(`✗ ${domain}: stellar.toml returned HTTP ${res.status}`);
  process.exit(1);
}
const toml = await res.text();

const network = grab(toml, "NETWORK_PASSPHRASE") || "(unset)";
const sep24 = grab(toml, "TRANSFER_SERVER_SEP0024");
const auth = grab(toml, "WEB_AUTH_ENDPOINT");
const signing = grab(toml, "SIGNING_KEY");

console.log(`\n  Anchor:   ${domain}`);
console.log(`  Network:  ${network}`);
console.log(`  SEP-10:   ${auth ?? "— (no WEB_AUTH_ENDPOINT)"}`);
console.log(`  SEP-24:   ${sep24 ?? "— (no TRANSFER_SERVER_SEP0024)"}`);
console.log(`  Signing:  ${signing ?? "—"}`);

if (!sep24) {
  console.error(`\n✗ ${domain} does not advertise a SEP-24 transfer server — not a hosted deposit/withdraw anchor.`);
  process.exit(2);
}
console.log(`\n✓ ${domain} is a real SEP-24 anchor. Set VITE_ANCHOR_HOME_DOMAIN=${domain} to route Shunt's cash-out through it.\n`);
