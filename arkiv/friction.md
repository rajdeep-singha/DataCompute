# Friction log

Honest notes on building on Arkiv, in the order we hit them.

## What worked well

- **Typed schemas with indexed columns.** `defineSchema` plus `.indexed()` made
  the query surface obvious: if a column is indexed, you can filter or sort on
  it. The schema doubles as documentation.
- **Ownership is free and real.** `ownedBy(watcher)` on every read means the page
  can only ever show alerts the watcher wallet actually signed. We didn't build
  an auth system — the chain is the auth.
- **Expiry is a feature, not a chore.** `ExpirationTime.fromDays(30)` gives the
  feed a natural rolling window; stale alerts drop off the page on their own.
- **Patch + extend.** `patchEntity` and `extendEntity` let the `upgrade.state`
  entity be a living record we update each run, instead of append-only sludge.

## Friction we hit

1. **Page size cap of 100.** A `limit(200)` on reads fails with
   *"limit 200 exceeds the node maximum of 100."* Fixed by capping at 100 and
   paging with an offset / `$key` cursor (the existing `loadOwned` already did
   this for the checks importer).
2. **`str` attributes cap at ~128 UTF-8 bytes.** Long detail strings silently
   need trimming; we route every `str` write through `fitStr()`.
3. **Browser wallets can't sign Arkiv writes.** Arkiv writes go through
   `eth_sendRawTransaction` with the SDK's own db-chain tx format, which
   MetaMask/RainbowKit cannot produce. So the *watcher* holds a local key and
   signs writes; the browser only reads. This shaped the whole architecture.
4. **`import.meta.env` is Vite-only.** Sharing a `browserClient()` between the
   React app and node scripts broke under `tsx`; node code uses `arkivPublic()`
   (reads `process.env`) instead.
5. **Public RPC is heavily rate limited.** Without an access key, reads time out
   under load. Passing `VITE_ARKIV_ACCESS_KEY` / `ARKIV_ACCESS_KEY` fixed it.

None of these were blockers — each had a clear message or a documented limit.
