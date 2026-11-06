import { addr, defineSchema, i32, str, u64 } from "@arkiv-network/sdk/schema"
import {
  ALERT_SCHEMA_NAME,
  ATTESTATION_SCHEMA_NAME,
  DIAMOND_CHECK_SCHEMA_NAME,
  LISTINGS_SCHEMA_NAME,
  PURCHASES_SCHEMA_NAME,
  READING_SCHEMA_NAME,
  SCHEMA_NAME,
  WATCH_STATE_SCHEMA_NAME,
} from "./config"

/**
 * One row is one check of one Ethereum address, owned by the verifier wallet.
 * Indexed columns are the ones the app and the public query filter on.
 * A named schema also writes `arkiv.schema`, so this is 11 attributes.
 */
export const Checks = defineSchema(SCHEMA_NAME, {
  chainId: u64().indexed(),
  subject: addr().indexed(),
  check: str().indexed(),
  status: str().indexed(),
  block: u64().indexed(),
  implementation: addr().indexed(),
  symbol: str().indexed(),
  name: str(),
  decimals: i32(),
  detail: str(),
})

/**
 * One row is one marketplace listing, written by the relayer on a seller's behalf.
 * `seller`/`payTo` are the seller's real wallet, so buyers pay on-chain and the
 * relayer never custodies funds. `preview` is the public teaser; the gated payload
 * (dataset contents or compute spec) lives off Arkiv in the backend, since anything
 * written here is readable by anyone. `priceWei` is a string to dodge u64 overflow.
 */
export const Listings = defineSchema(LISTINGS_SCHEMA_NAME, {
  kind: str().indexed(),
  title: str(),
  summary: str(),
  category: str().indexed(),
  priceWei: str(),
  seller: addr().indexed(),
  payTo: addr(),
  preview: str(),
  status: str().indexed(),
  createdBlock: u64(),
})

/**
 * One row is one purchase, written only after the relayer confirms the buyer's
 * tGLM payment on Rabdi. `txHash` is the on-chain receipt and is indexed so a
 * payment can only be redeemed once.
 */
export const Purchases = defineSchema(PURCHASES_SCHEMA_NAME, {
  listingKey: str().indexed(),
  buyer: addr().indexed(),
  seller: addr().indexed(),
  amountWei: str(),
  txHash: str().indexed(),
  block: u64(),
  kind: str(),
})

/**
 * One row is one detected proxy upgrade, written by the watcher wallet.
 * Indexed columns are what the alert page and public API filter on:
 * which proxy, how risky, whether the new code is verified, and when.
 * `verified` is one of: exact_match | match | unverified | unknown.
 * `severity` is one of: critical | warning | info.
 */
export const UpgradeAlerts = defineSchema(ALERT_SCHEMA_NAME, {
  proxy: addr().indexed(),
  proxyName: str().indexed(),
  oldImpl: addr().indexed(),
  newImpl: addr().indexed(),
  verified: str().indexed(),
  severity: str().indexed(),
  block: u64().indexed(),
  detail: str(),
  /** Swarm reference (bzz hash) of the evidence bundle: bytecode + Sourcify metadata. Empty if Swarm was off. */
  evidence: str(),
})

/**
 * One row per watched proxy: the implementation the watcher last saw.
 * The watcher patches it when the slot changes, so a change is detected by
 * diffing chain state against this entity. Owned by the watcher wallet.
 */
export const WatchState = defineSchema(WATCH_STATE_SCHEMA_NAME, {
  proxy: addr().indexed(),
  proxyName: str(),
  impl: addr(),
  block: u64(),
})

/**
 * One row is one chain's result in one diamond check run, written by the watcher wallet.
 * Every chain in a run shares `run` (unix ms), so the latest run is `ORDER BY run DESC`.
 * `verdict` is ok | changed | suspicious | unreachable | unpinned; `severity` is
 * critical | warning | info. "Which chain is malicious" is `severity = critical`.
 */
export const DiamondChecks = defineSchema(DIAMOND_CHECK_SCHEMA_NAME, {
  diamond: str().indexed(),
  chainId: u64().indexed(),
  chainName: str(),
  address: addr().indexed(),
  verdict: str().indexed(),
  severity: str().indexed(),
  run: u64().indexed(),
  findings: u64(),
  detail: str(),
  /** Swarm reference of the full findings for the run. Empty if Swarm was off. */
  evidence: str(),
})

/**
 * One row is one verifier attestation for a listing, written when it's published.
 * `tier` is verified | attested | self-reported. Separate from the listing so it's
 * additive — a listing can be published, then verified, without rewriting it.
 */
export const Attestations = defineSchema(ATTESTATION_SCHEMA_NAME, {
  listingKey: str().indexed(),
  tier: str().indexed(),
  verifiedBy: addr(),
  detail: str(),
  block: u64(),
})

/**
 * One row is one attested solar reading from the Aethera oracle, written by the
 * oracle wallet. Mirrors Aethera's own snapshot: NREL annual-average irradiance
 * (kWh/m²/day, stored ×100 as integers) for a location, plus the Aptos `txHash`
 * that recorded it on-chain. These are public provenance — anyone can query them
 * to confirm the feed is real and already proven on Aptos, even without buying
 * the full feed on the marketplace. `lat`/`lon` are decimal strings.
 */
export const AetheraReadings = defineSchema(READING_SCHEMA_NAME, {
  site: str().indexed(),
  lat: str(),
  lon: str(),
  dniCenti: u64(),
  ghiCenti: u64().indexed(),
  latTiltCenti: u64(),
  observedAt: u64().indexed(),
  txHash: str().indexed(),
  oracleAddress: str(),
})
