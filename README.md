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
