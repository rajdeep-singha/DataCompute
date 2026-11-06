# Reach

## Who this is for

Anyone exposed to an upgradeable contract they don't control:

- **DeFi users and LPs** holding USDC, or supplying to Aave / Compound, who want
  to know the moment an admin swaps the implementation — especially to code that
  isn't verified.
- **Security researchers and auditors** who track proxy upgrades across many
  protocols and want a normalized, queryable, timestamped feed.
- **Wallets and dashboards** that could surface "this token you hold just
  upgraded to unverified code" as a warning, by querying Arkiv directly.

## Why it matters

Swapping a proxy's implementation to **unverified** code is a real warning sign —
it's how several rugs and compromised-admin incidents began. The raw fact (the
storage slot changed) is public but noisy; the *enriched* fact (changed, and the
new code is unverified, at this block, for this named contract) is what a human
can act on. That's what each alert captures.

## How reach compounds on Arkiv

The feed isn't locked inside our frontend. Because every alert is a public,
owned, queryable Arkiv entity, **any** app can read it:

```
npm run query:alerts -- --all
```

A wallet could run that same query and show its users the critical alerts for
tokens they hold. The dataset is the product; our page is just one reader of it.

## Extending the watchlist

Reach scales by widening [`WATCHLIST`](../src/config.ts) — the watcher reads both
the EIP-1967 and legacy OpenZeppelin implementation slots, so most mainnet
proxies are covered without per-contract code. Adding a proxy is one line.
