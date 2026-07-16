# Shunt keeper — Cloudflare Worker

Detects USDC inflows and prepares an unsigned `distribute` XDR for the user's
one-tap wallet approval. It runs as a Cloudflare Worker rather than an
always-on Node process: Cloudflare's free plan needs no credit card, has no
sleep/idle timeout, and Cron Triggers don't disappear after an hour the way
some free static-hosting tunnels do. (An earlier Node/SSE keeper was replaced
by this Worker — this directory is the only keeper now.)

The one behavior change: instead of a live Horizon SSE stream, a Cron
Trigger polls for new payments once a minute. State (processed tx hashes,
per-account paging cursor, pending splits) lives in Workers KV instead of a
local JSON file, since a Worker has no persistent disk between invocations.

## One-time setup

```bash
cd keeper
npm install
npx wrangler login                     # opens a browser, no credit card needed
npx wrangler kv namespace create KEEPER_KV
# copy the returned "id" into wrangler.toml -> [[kv_namespaces]] -> id
```

## Deploy

```bash
npx wrangler deploy
```

Wrangler prints the live URL, e.g. `https://shunt-keeper.<your-subdomain>.workers.dev`.
Put that in the web app's `VITE_KEEPER_URL` (Vercel env var), then redeploy
the frontend.

## Local dev

```bash
npm run dev
# Cron doesn't fire on its own locally — trigger it manually:
curl http://127.0.0.1:8787/cdn-cgi/handler/scheduled
```

## Config

Everything is in `wrangler.toml` under `[vars]` — network, Horizon/RPC URLs,
the USDC issuer, the vault contract id, and the comma-separated list of
watched accounts. Edit and redeploy; no separate `.env` file.
