# Why Arkiv

The question this app answers — *"which high-value proxies just upgraded, and is
the new code verified?"* — is a **query**, not a file. Arkiv is the right home
for it because the data is small, structured, owned, and time-bounded.

## Why not a plain database?

A centralized DB could store the same rows, but then "trust the alerts" means
"trust our server." On Arkiv:

- **Every alert is signed by the watcher wallet.** `ownedBy(watcher)` on reads
  means nobody can slip a forged alert into the feed. Provenance is built in.
- **Anyone can re-run the query.** The dataset is public and verifiable — a judge
  (or a user who distrusts us) can query Arkiv directly and get the same answer,
  without our frontend. See [`how-you-use-arkiv.md`](./how-you-use-arkiv.md).
- **No server to keep alive for reads.** The page is a static client that talks
  to Arkiv. The watcher only runs to *write*.

## Why not just events / a subgraph?

Proxy upgrades don't always emit a consistent event (USDC uses a legacy
implementation slot; others use EIP-1967). We read the storage slot directly and
record a normalized, enriched alert — with the Sourcify verdict attached, which
no on-chain event carries. Arkiv stores that derived, cross-referenced record and
makes it filterable.

## Why Arkiv's specific features matter here

- **Indexing** → filter by severity / proxy / verification status instantly.
- **Ownership** → the feed is trustworthy by construction.
- **Expiry** → a security alert feed *should* be a rolling window; old alerts
  expiring is correct behavior, and Arkiv does it natively.

The app isn't using Arkiv as a dumb store — it uses the three features the track
scores (filtering, ownership, expiry) to do visible, load-bearing work.
