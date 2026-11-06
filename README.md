# DataVerify — proxy upgrade alerts on Arkiv

Watch high-value Ethereum proxies (USDC, Aave, Compound …). When a proxy's
implementation changes, ask **Sourcify** whether the new code is verified, and
write an **`upgrade.alert`** entity to **Arkiv**. A swap to *unverified* code is
the red flag. The alert page and a public query read those entities back, with
filtering, ownership, and expiry all doing visible work.

Built for **ETHweek — Build on Arkiv (from scratch)**.

## What it does

1. `npm run watch` reads each watched proxy's implementation slot (EIP-1967 and
   the legacy OpenZeppelin slot, so USDC is covered too).
2. On a change, it calls Sourcify and classifies the result:
   `exact_match` / `match` / `unverified` / `unknown`.
3. It writes an `upgrade.alert` entity owned by the watcher wallet, expiring in
   ~30 days, and patches that proxy's `upgrade.state` row.
4. The web app and `npm run query:alerts` query Arkiv — filter by severity,
   verification status, or proxy; newest first.

Severity: **critical** = new code unverified · **warning** = verified change ·
**info** = baseline (first time a proxy is observed).

## Watcher wallet

```
0x329753C220B38b8901fB38a247cdcD77f6AC8529
```

All alerts and state are owned by this wallet on the Rabdi testnet. Reads are
scoped to it, so only alerts this wallet signed can appear in the feed.

## One query judges can run

```bash
npm install
cp .env.example .env            # add an ARKIV_ACCESS_KEY for reliable reads
npm run query:alerts            # critical (unverified) upgrades, newest first
npm run query:alerts -- --all   # every alert the watcher has written
```

Example output:

```
query: arkiv.schema = str('upgrade.alert') AND severity = str('critical')
       AND $owner = addr(0x329753C220B38b8901fB38a247cdcD77f6AC8529) ORDER BY block DESC
[critical] USDC  0x4350…02dd -> 0x0000…dEaD  unverified  (block 26351600)
```

Or open the UI: `npm run dev` → **Upgrade alerts** tab → filter `severity =
critical`.

## Run the watcher yourself

```bash
# .env needs PRIVATE_KEY (funded at https://hub.arkiv.network/faucet)
npm run watch                     # baseline: records each proxy's current impl
npm run watch                     # again: "unchanged" for all (idempotent)
npm run watch -- --simulate USDC  # demo: forces a critical (unverified) alert
npm run watch -- --reset          # delete the watcher's alerts + state, re-baseline
```

## Marketplace: Aethera Solar Oracle (verified real-world data)

The marketplace sells **verified data you can't get free** — the flagship being
the **[Aethera](https://github.com) solar oracle**: NREL annual-average irradiance
(**DNI / GHI / lat-tilt**, kWh/m²/day) for US solar sites. Aethera fetches it from
NREL and pushes it **on-chain to Aptos** — so each reading already carries an
**Aptos transaction proof**. DataVerify re-attests those readings on **Arkiv**
(schema `aethera.solar`) to make them queryable and sellable.

That's a two-chain provenance chain a buyer can verify end to end:

```
NREL  →  Aptos (tx proof, source of truth)  →  Arkiv (queryable attestation)  →  buyer
```

```bash
npm run seed:aethera   # attests Aethera's readings on Arkiv + creates the listing
```

**How buyers use it:** connect wallet → the listing shows "✓ N readings attested
on Arkiv" + the latest reading with its **Aptos tx link** → **Buy** (tGLM on Rabdi)
→ the backend returns the full feed as a table (DNI/GHI/lat-tilt per site, each row
linking to its Aptos proof) with **download JSON** and a copy-paste **how-to-use**
snippet. Consumers: solar-farm investors/insurers, energy-trading dApps,
carbon-credit verifiers, DePIN protocols that need solar data as an input.

By default the demo runs on a **real Aethera snapshot** bundled with the repo. Set
`AETHERA_DATA_DIR` to Aethera's `server/data` folder to serve its live output.
Code: [`src/lib/aethera/`](./src/lib/aethera), [`src/seed-aethera.ts`](./src/seed-aethera.ts).

### More assets (the provider framework)

New marketplace assets plug in as a single **provider** entry
([`src/lib/marketplace/providers.ts`](./src/lib/marketplace/providers.ts)) — id,
listing text, Data-Power pricing, column descriptors, and a `load()` that serves
the records. The backend serves any provider on purchase; the UI renders it
generically. Seed them with `npm run seed:market`. Shipping today:

| asset | kind | what / why not free | provenance |
|-------|------|----------------------|------------|
| **Research Intelligence** | dataset | 96 classified, relevance-scored RWA/carbon/DePIN articles — curation is the product | batch hash attested on Arkiv |
| **Admin-Risk feed** | dataset | the watcher's own proxy-upgrade history — admin-key monitoring auditors pay for | every alert signed on Arkiv |
| **DePIN Registry** | dataset | aggregate solar installer/project growth (no PII) | on-chain registry on Aptos |
| **Rug-Risk score** | compute | name a token → live metadata/proxy/verification risk | computed at purchase |

### Pricing: the Data Power Index

Prices aren't arbitrary — they're computed from the data itself. A dataset's
**Data Power Index (DPI)** is the product of five dimensionless factors, and the
price is the base price scaled by it:

```
price = basePrice · φ · γ · δ · ι · ρ
        ├ φ freshness = 2^(−ageDays / halfLife)     recent data worth more (clamped 0.1–1)
        ├ γ coverage  = 1 + 0.5·log2(sites)          more locations, diminishing returns
        ├ δ depth     = 1 + 0.1·log10(readings)      more data points, diminishing returns
        ├ ι integrity = completeness · (1 + 0.5·proven)   quality × on-chain-proof premium
        └ ρ rarity    = per-dataset constant          scarce (not free) > public
```

`proven` is the share of readings carrying a valid on-chain (Aptos) tx — so
**verifiable data earns a premium**, which is the whole point of DataVerify. For
the live Aethera feed this currently yields **DPI ≈ 2.79× → 0.0278 tGLM**
(freshness 0.66 · coverage 1.79 · depth 1.05 · integrity 1.5 · rarity 1.5). The
listing card shows this breakdown so buyers see exactly why the price is what it
is. Code: [`src/lib/marketplace/pricing.ts`](./src/lib/marketplace/pricing.ts).

## System notifications for malicious upgrades

Click **🔔 Enable alerts** in the header to grant notification permission. The page
then polls Arkiv for `severity = critical` upgrade alerts (a swap to unverified
code) and fires a real **system notification** — "⚠ USDC upgraded to UNVERIFIED
code" — the moment a new one is written, by anyone (the in-app button, the CLI,
or a cron watcher). Existing alerts at the time you enable are adopted silently,
so only genuinely new upgrades notify.

**How to test it** — you don't need any mock contracts:

1. Open the app, click **🔔 Enable alerts** (allow in the browser prompt).
2. Go to **Upgrade alerts → Simulate upgrade** (or run
   `npm run watch -- --simulate USDC`). This writes a clearly-labelled critical
   alert to Arkiv.
3. Within ~12s the system notification fires.

The watchlist (USDC, Aave, Compound) covers real proxies for genuine future
upgrades; `--simulate` is the reliable on-demand trigger for the demo.

Code: [`src/lib/notify.ts`](./src/lib/notify.ts),
[`src/hooks/useCriticalAlertNotifier.ts`](./src/hooks/useCriticalAlertNotifier.ts).

## Telegram notifications and continuous monitoring

Telegram delivery runs on the backend and works with the website closed. Both
proxy upgrades and diamond findings enqueue messages as soon as classification
finishes, before Swarm uploads or Arkiv writes. These are **detection notices**:
the message explicitly says audit evidence may still be pending. A failed Arkiv
write does not invalidate or retract the observed finding. This first version
links to the contract and dashboard; it does not send a follow-up evidence link.

Requires **Node >=22.13** for built-in SQLite (Node may print an experimental
SQLite warning). No additional service or npm dependency is needed.

### Connect your bot

Open **Telegram bot** in the dashboard sidebar (`/telegram`) for setup steps,
current configuration status, and a link to your bot. The page reads the bot's
public identity from Telegram and never exposes the bot token or destination
chat ID. **Ready to test** means the bot is verified and a destination is
configured; use a simulation to verify actual delivery. Opening the bot does
not automatically subscribe a visitor—the destination is shared by the workspace.

1. Create a dedicated bot with [@BotFather](https://t.me/BotFather), using `/newbot`.
2. Add `TELEGRAM_BOT_TOKEN` to your local `.env` (never a `VITE_` variable).
3. Open the bot in Telegram and send `/start`. For a group, add the bot and send
   a command addressed to it; ensure it can post messages.
4. Run `npm run telegram -- chats`, then put the intended `TELEGRAM_CHAT_ID` in
   `.env`. This reads recent bot updates; it does not send a message. Use a
   dedicated bot without an existing webhook. For a channel, configure its
   chat ID and grant the bot permission to post.

   If the bot token is missing, the command prompts for it privately in your
   terminal (input is hidden) and saves it to the project's `.env` without
   rewriting other settings. Paste the BotFather token and press Enter. Do not
   paste it into chat or include it as a command-line argument.
5. Set `PUBLIC_APP_URL` to the dashboard URL your phone can reach. `localhost`
   links only work on the machine running the app.
6. Start `npm run dev:all` and use **Simulate attack** in the Diamond inspector,
   or **Simulate upgrade** in Upgrade alerts. Telegram messages begin with
   **🧪 SIMULATION**, separate from live finding state.

See Telegram's [bot setup guide](https://core.telegram.org/bots/features#botfather)
and [sendMessage API](https://core.telegram.org/bots/api#sendmessage).

### Keep checking automatically

```bash
npm run monitor               # API server + delivery worker + continuous checks
npm run dev                   # optional frontend, in a separate terminal
```

Alternatively set `MONITOR_ENABLED=true` and use the normal server/dev:all
command. **Run one API/monitor process**, not both `server` and `monitor`.
Scheduled checks share the API's writer lock with manual checks and simulations.
Do not run the standalone watcher/diamond CLI concurrently with the monitor:
their Arkiv writer lock is process-local.

Each cycle checks proxies and then configured diamonds. The default delay is
60 seconds **after the previous cycle finishes**, configurable with
`MONITOR_INTERVAL_SECONDS` (minimum 15). A cycle skips if a manual check is
already running. Diamond chains notify independently as each chain finishes.
End-to-end latency includes that cadence, RPC reads, source verification and
Telegram delivery. This is periodic state monitoring, not a guarantee of seeing
every intermediate upgrade between polls. It does not monitor arbitrary storage
or all contract activity. Normal block/reorganization uncertainty also applies.

The proxy watcher still refreshes Arkiv state on unchanged passes; diamond
checks still write a batch every cycle. Budget RPC usage and the funded writer
wallet accordingly. Initial proxy baselines stay silent. A diamond's existing
deviation from its pinned manifest is reported on the first check.

### Delivery behavior and operations

- Real proxy upgrades and changed diamond findings notify. Identical unresolved
  diamond findings are suppressed across restarts. Matching the manifest again
  sends a recovery message. Monitoring outages/restoration use separate alerts.
- Simulations always produce their own notices and cannot clear live findings.
- Source verification is a risk signal, not proof that code is safe or malicious.
- Pending jobs, retry schedules and observation state live in
  `data/telegram.sqlite` (gitignored). Set `TELEGRAM_OUTBOX_PATH` to a persistent
  local disk path on deployment. SQLite coordinates delivery workers on one
  host; this is not a distributed queue for multiple hosts or network storage.
- Telegram network/5xx failures retry with exponential backoff; 429 responses
  respect `retry_after`. Sends are spaced by at least 3.1 seconds per destination.
  4xx configuration/permission failures remain marked failed for operator repair.
- The bot token is not stored in SQLite and errors do not expose Telegram URLs.
  Queue state is scoped to bot ID + chat ID, so changing destinations does not
  forward old queued messages to a new recipient.
- Delivery is **at least once**: a crash or lost response after Telegram accepts
  a message can cause a repeat. Telegram has no sendMessage idempotency key.
  Disk errors are logged without failing the check, but can lose notification
  intent; monitor disk health. Notifications do not backfill historical Arkiv rows.

```bash
npm run telegram -- status    # pending/failed counts for the configured bot/chat
npm run telegram -- retry     # requeue failed jobs after fixing credentials/permissions
npm run telegram -- worker    # delivery/retries only; no contract checks or Arkiv writes
```

Standalone `watch` and `diamond:check` commands enqueue notifications and attempt
one due delivery on exit. Keep the API or delivery worker running to drain all
messages and retry failures. API startup also resumes pending deliveries.

### Public deployment

The API binds to `127.0.0.1` by default. Set a strong `WATCH_API_TOKEN` before
exposing it publicly, **including through a reverse proxy**; a non-loopback
`HOST` requires that token. The web UI asks for the operator token on the first
protected check and retains it only in memory. Use HTTPS. Never share this
operator credential with public viewers or put it in frontend environment vars.
Both check endpoints also have a shared 10-second cooldown. For a public demo,
an operator can trigger simulations while viewers browse the read-only results.

Code: [`src/lib/notifications/`](./src/lib/notifications/),
[`server/monitor.ts`](./server/monitor.ts).

## Cross-chain diamond check (which chain is malicious?)

An [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535) diamond has no single
implementation slot: it routes every function selector to a **facet** contract,
and the same diamond often runs on many chains. The diamond check reads every
chain's facets through the standard loupe (`facets()`), hashes each facet's
deployed code, reads `owner()`, and compares each chain with a **pinned
manifest** of what that chain is expected to run.

Each chain is compared with its own manifest, not with the other chains, because
real multi-chain diamonds differ on purpose. The LI.FI Diamond
(`0x1231…4EaE`) runs 42 facets on Ethereum but 29 on Polygon, and it has a
different owner on Ethereum.

| finding | severity |
|---------|----------|
| new function, or a function now running different code, on a facet **unverified** on Sourcify for that chain | **critical** (likely malicious) |
| owner changed | **critical** |
| the same change, but the new facet is verified | warning |
| function removed, or the chain couldn't be read | warning |
| matches the manifest | info (ok) |

A facet redeployed at a new address with identical code is not a change. Each
run writes one `diamond.check` entity per chain in a single Arkiv batch, all
sharing a `run` id, so "which chain is malicious" is a query:
`diamond = "lifi" AND severity = "critical" ORDER BY run DESC`.

```bash
npm run diamond:pin -- lifi                  # snapshot all chains as the trusted manifest (review first!)
npm run diamond:pin -- lifi --days-ago 30    # pin the state from 30 days back (archive RPCs), so the next
                                             # check shows the real upgrades made since then
npm run diamond:check -- lifi                # compare every chain, write results to Arkiv
npm run diamond:check -- lifi --simulate 137 # demo: plant a fake unverified facet on Polygon
```

In the UI, open the **Diamond check** tab. **Check all chains** runs a check, and
**Simulate attack** plants a fake unverified `emergencyWithdraw(address,uint256)`
facet on the chosen chain, for that run only. That chain then shows
*"⚠ Likely malicious on Polygon"*, while the others stay ok. Pinning is CLI-only
on purpose: the web server can check, but it can never re-baseline what counts as
trusted. Public RPCs are used by default; set `RPC_<chainId>` in `.env` to
override one.

Code: [`src/lib/diamond/`](./src/lib/diamond), manifest in
[`src/lib/diamond/manifests/lifi.json`](./src/lib/diamond/manifests/lifi.json).

## Swarm evidence (Arkiv + Swarm bonus)

Each alert can pin an evidence bundle — old + new implementation bytecode and a
Sourcify metadata snapshot (~82 KB for USDC) — to **Swarm**, storing only the
`bzz` reference on the Arkiv entity. The UI shows it as an **evidence ↗** link.
Swarm is optional and degrades gracefully. To enable it:

```bash
bee dev                                               # free dev-mode postage stamp, no BZZ
BEE_API_URL=http://localhost:1633 npm run watch -- --reset
```

Details in [`arkiv/swarm.md`](./arkiv/swarm.md).

## Project layout

| path | role |
|------|------|
| `src/watch.ts` | the watcher: read slots → Sourcify → write alerts + state |
| `src/lib/sourcify.ts` | Sourcify v2 verification lookup |
| `src/lib/swarm.ts` | Bee HTTP client — pins evidence bundles to Swarm |
| `src/lib/evidence.ts` | assembles bytecode + Sourcify metadata bundle |
| `src/lib/ethereum.ts` | dual-slot (EIP-1967 + legacy) implementation reader |
| `src/schema.ts` | `upgrade.alert` and `upgrade.state` Arkiv schemas |
| `src/lib/read-alerts.ts` | filtered reads for the UI |
| `src/query-alerts.ts` | the public CLI query |
| `src/components/AlertsViewer.tsx` | the alert page |
| `src/lib/diamond/` | diamond loupe reader, manifest diff, cross-chain check |
| `src/components/diamond/DiamondViewer.tsx` | the diamond check page |
| `src/lib/diamond/` | diamond loupe reader, manifest diff, cross-chain check |
| `src/components/diamond/DiamondViewer.tsx` | the diamond check page |
| `arkiv/` | track docs: schema, friction, reach, why-arkiv, how-you-use-arkiv |

## Arkiv usage at a glance

- **Filtering** — indexed `severity`, `verified`, `proxy`, `block`.
- **Ownership** — alerts trusted only from the watcher wallet (`ownedBy`).
- **Expiry** — 30-day rolling window; stale alerts drop off.
- **Mutation** — `upgrade.state` is patched + extended, not appended.

Details in [`arkiv/how-you-use-arkiv.md`](./arkiv/how-you-use-arkiv.md).

## License

MIT — see [LICENSE](./LICENSE).

## How AI was used

Built with Claude Code (Anthropic). AI wrote the watcher, Sourcify client,
Arkiv schemas/queries, and React UI, and verified each step against live
mainnet, Sourcify, and Arkiv (not just by compiling). All architectural
decisions — the two-schema design, dual-slot reading, severity model, and the
Arkiv-native use of ownership/expiry/filtering — were reviewed and directed by a
human. External data: the Sourcify v2 API and the Uniswap default token list
(the latter only in the separate token-checks tool).
