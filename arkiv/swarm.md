# Arkiv + Swarm bonus

Swarm does real, load-bearing work here: it stores the **evidence** behind each
alert, which is too large and too raw to belong on Arkiv.

## What goes on Swarm

For every upgrade alert, the watcher assembles an evidence bundle and uploads it
to Swarm:

- the **old implementation bytecode** (`eth_getCode`),
- the **new implementation bytecode**,
- a **Sourcify metadata snapshot** of the new implementation,
- the proxy, block, and observation timestamp.

A real USDC bundle is ~82 KB (23 KB of bytecode plus metadata) — exactly the kind
of blob Swarm is for and Arkiv is not (Arkiv `str` caps at ~128 bytes).

## What goes on Arkiv

Only the **bzz reference** (a 64-hex Swarm hash) is stored on the alert entity,
in its `evidence` attribute. So Arkiv stays the small, queryable index; Swarm
holds the heavy, verifiable payload. The alert page turns the reference into a
gateway link anyone can open to audit the bytecode and metadata themselves.

```
alert.evidence  →  https://api.gateway.ethswarm.org/bytes/<reference>
```

## Division of labour

| layer | holds | why |
|-------|-------|-----|
| Ethereum | the proxy and its implementation slot | source of truth |
| Sourcify | whether the new code is verified | attestation |
| **Swarm** | **the evidence bundle (bytecode + metadata)** | **big, immutable, content-addressed** |
| Arkiv | the alert record + the Swarm reference | small, owned, queryable, expiring |

## Running it

Swarm is optional and degrades gracefully — with no Bee node, alerts are written
with an empty `evidence` reference and everything else works. To turn it on:

```bash
bee dev                              # free dev-mode node, usable postage stamp, no BZZ
BEE_API_URL=http://localhost:1633 npm run watch -- --reset
```

The watcher logs `swarm on`, prints `swarm evidence → bzz:<reference>` per alert,
and the reference shows as an **evidence ↗** link on each row in the UI.

## Code

- [`src/lib/swarm.ts`](../src/lib/swarm.ts) — Bee HTTP client (stamp + upload), never throws.
- [`src/lib/evidence.ts`](../src/lib/evidence.ts) — assembles the bundle from chain + Sourcify.
- [`src/watch.ts`](../src/watch.ts) — `evidenceReference()` uploads and stores the ref on the alert.
