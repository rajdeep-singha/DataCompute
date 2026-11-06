# How you use Arkiv

Every Arkiv feature in the app does a concrete, visible job. Here is each one,
with the code that uses it.

## Filtering (indexed reads)

The alert page and the public CLI filter on indexed columns:

- **Severity** — `where(eq("severity", "critical"))` → only upgrades to
  unverified code.
- **Verification** — `where(eq("verified", "unverified"))`.
- **Proxy** — `where(eq("proxy", addr(...)))` → every upgrade for one contract.
- **Recency** — `orderBy(desc("block"))` → newest upgrades first.

Code: [`src/lib/read-alerts.ts`](../src/lib/read-alerts.ts),
[`src/query-alerts.ts`](../src/query-alerts.ts).

```
npm run query:alerts                      # critical (unverified) upgrades, newest first
npm run query:alerts -- --severity warning
npm run query:alerts -- --all
```

## Ownership

- **Writes** are signed by the watcher wallet (local key).
- **Reads** are scoped with `ownedBy(watcherAddress)`, so the page only ever
  shows alerts that wallet actually signed. A forged alert from another wallet
  cannot appear in the feed.

Code: `readAlerts(... owner)` in [`src/lib/read-alerts.ts`](../src/lib/read-alerts.ts);
writes in [`src/watch.ts`](../src/watch.ts).

## Expiry

- Alerts are written with `ExpirationTime.fromDays(30)`, so the feed is a rolling
  30-day window — old alerts drop off the page automatically.
- The `upgrade.state` entity is **extended** (`extendEntity`) on every run so the
  watcher's memory of each proxy never expires while the watcher is live.

Code: `expiration` in [`src/watch.ts`](../src/watch.ts); the page renders time
left via `expiryLabel()` in [`src/lib/format.ts`](../src/lib/format.ts).

## Mutation (patch)

When a proxy's implementation changes, the watcher **patches** that proxy's
`upgrade.state` entity in place (`patchEntity`) rather than appending — so state
is one row per proxy, not an ever-growing log.

Code: `upsertState()` in [`src/watch.ts`](../src/watch.ts).
