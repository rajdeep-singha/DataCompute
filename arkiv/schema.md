# Arkiv schema

DataVerify's own data lives on Arkiv (Rabdi testnet). The watcher writes two
named schemas; the alert page and the public query read them back.

## `upgrade.alert`

One entity = one detected proxy upgrade. This is the app's primary dataset.

| attribute   | type   | indexed | meaning |
|-------------|--------|:-------:|---------|
| `proxy`     | addr   | ✅ | the watched proxy contract |
| `proxyName` | str    | ✅ | human label, e.g. `USDC` |
| `oldImpl`   | addr   | ✅ | implementation before the change (`0x0` on first sight) |
| `newImpl`   | addr   | ✅ | implementation after the change |
| `verified`  | str    | ✅ | Sourcify verdict: `exact_match` \| `match` \| `unverified` \| `unknown` |
| `severity`  | str    | ✅ | `critical` (new code unverified) \| `warning` (verified change) \| `info` (baseline) |
| `block`     | u64    | ✅ | Ethereum block height when the upgrade was observed |
| `detail`    | str    |   | one-line human summary |
| `evidence`  | str    |   | Swarm `bzz` reference of the evidence bundle (bytecode + Sourcify metadata), or `""` |

A named schema also writes `arkiv.schema`, so this is 10 attributes per entity.
See [`swarm.md`](./swarm.md) for what the `evidence` reference points at.

Indexed columns are exactly what the UI and the public API filter and sort on:
severity, verification status, which proxy, and recency (`block`).

## `upgrade.state`

One entity per watched proxy: the implementation the watcher last saw. The
watcher diffs live chain state against this to decide whether anything changed,
and **patches** it in place when it does — demonstrating Arkiv mutation, not
just append.

| attribute   | type | indexed | meaning |
|-------------|------|:-------:|---------|
| `proxy`     | addr | ✅ | the watched proxy |
| `proxyName` | str  |   | human label |
| `impl`      | addr |   | last-seen implementation |
| `block`     | u64  |   | block height at last observation |

Both schemas are defined in [`src/schema.ts`](../src/schema.ts).
