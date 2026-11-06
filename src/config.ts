export const SCHEMA_NAME = "dataverify.checks"
export const LISTINGS_SCHEMA_NAME = "dataverify.listings"
export const PURCHASES_SCHEMA_NAME = "dataverify.purchases"
export const ATTESTATION_SCHEMA_NAME = "dataverify.attestation"

/** Trust tiers a listing can carry, set by the verifier at publish time. */
export const TRUST_TIERS = ["verified", "attested", "self-reported"] as const
export type TrustTier = (typeof TRUST_TIERS)[number]

/** Arkiv's testnet, where listings, purchases and tGLM payments all live. */
export const RABDI_CHAIN_ID = 7794095

/** Listings and purchases stay queryable for a month. */
export const LISTING_LIFETIME_DAYS = 30

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const

/** Checks stay queryable for a week. The import extends them on the next run. */
export const CHECK_LIFETIME_DAYS = 7

export const TOKEN_LIST_URL =
  "https://cdn.jsdelivr.net/npm/@uniswap/default-token-list@18.10.0/build/uniswap-default.tokenlist.json"

export const TOKEN_LIST_LICENSE = "GPL-3.0-or-later"
export const TOKEN_LIST_LICENSE_URL =
  "https://github.com/Uniswap/default-token-list/blob/main/LICENSE"

/** Always verified, so the demo addresses stay stable when `--limit` is small. */
export const PINNED_MAINNET = [
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
] as const

export const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const

/** Legacy OpenZeppelin/zeppelinos slot = keccak256("org.zeppelinos.proxy.implementation"). USDC uses this. */
export const LEGACY_IMPLEMENTATION_SLOT =
  "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3" as const

/* ------------------------------------------------------------------ *
 * Upgrade watcher: the app's own data lives on Arkiv.
 * The watcher reads each proxy's implementation slot, and when it
 * changes, asks Sourcify whether the new code is verified, then writes
 * an upgrade.alert entity owned by the watcher wallet, expiring in ~30d.
 * ------------------------------------------------------------------ */

export const ALERT_SCHEMA_NAME = "upgrade.alert"
export const WATCH_STATE_SCHEMA_NAME = "upgrade.state"

/* ------------------------------------------------------------------ *
 * Aethera solar oracle: the marketplace's flagship real-world dataset.
 * Readings are attested on Arkiv (public provenance) so buyers can trust
 * them; the full feed is sold through the marketplace.
 * ------------------------------------------------------------------ */
export const READING_SCHEMA_NAME = "aethera.solar"
/** Readings stay queryable for a week; the seeder refreshes them. */
export const READING_LIFETIME_DAYS = 7

/** The flagship marketplace listing for Aethera's solar oracle feed. */
export const AETHERA_LISTING = {
  kind: "oracle",
  title: "Aethera Solar Oracle — NREL irradiance, proven on Aptos",
  summary: "DNI / GHI / lat-tilt irradiance (kWh/m²/day) for US solar sites. Pushed on-chain to Aptos by Aethera, re-attested on Arkiv.",
  category: "solar-oracle",
  priceTgml: "0.01",
  preview: "3 sites · DNI/GHI/lat-tilt · each reading carries an Aptos tx proof",
} as const

/** Aethera's Aptos oracle, for linking readings to their on-chain proof. */
export const APTOS_EXPLORER_TX = (hash: string, network = "testnet") =>
  `https://explorer.aptoslabs.com/txn/${hash}?network=${network}`

/**
 * Data Power pricing for the Aethera feed. NREL annual averages are stable for
 * roughly a year, so freshness decays slowly (365-day half-life). Rarity > 1
 * because this data isn't available free elsewhere. See `lib/marketplace/pricing.ts`.
 */
export const AETHERA_PRICING = {
  basePriceTgml: 0.01,
  halfLifeDays: 365,
  rarity: 1.5,
} as const

/* ------------------------------------------------------------------ *
 * Diamond check: one EIP-2535 diamond deployed on several chains.
 * Each chain's facets are compared to a pinned manifest of what that
 * chain is expected to run; the result is one diamond.check entity per
 * chain, so "which chain is malicious" is a query on severity.
 * ------------------------------------------------------------------ */
export const DIAMOND_CHECK_SCHEMA_NAME = "diamond.check"
export const DIAMOND_CHECK_LIFETIME_DAYS = 30

/** `archiveRpc` serves old state, used only when pinning a manifest from the past. */
export const DIAMOND_CHAINS = [
  { chainId: 1, name: "Ethereum", rpc: "https://ethereum.publicnode.com", archiveRpc: "https://eth.drpc.org", explorer: "https://etherscan.io" },
  { chainId: 42161, name: "Arbitrum", rpc: "https://arbitrum-one.publicnode.com", archiveRpc: "https://arb1.arbitrum.io/rpc", explorer: "https://arbiscan.io" },
  { chainId: 10, name: "Optimism", rpc: "https://optimism.publicnode.com", archiveRpc: "https://mainnet.optimism.io", explorer: "https://optimistic.etherscan.io" },
  { chainId: 8453, name: "Base", rpc: "https://base.publicnode.com", archiveRpc: "https://mainnet.base.org", explorer: "https://basescan.org" },
  { chainId: 137, name: "Polygon", rpc: "https://polygon-bor.publicnode.com", archiveRpc: "https://polygon.drpc.org", explorer: "https://polygonscan.com" },
] as const

export const DIAMONDS = [
  {
    id: "lifi",
    name: "LI.FI Diamond",
    address: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
    chainIds: [1, 42161, 10, 8453, 137],
  },
] as const

export type DiamondId = (typeof DIAMONDS)[number]["id"]

export function diamondChain(chainId: number) {
  return DIAMOND_CHAINS.find((chain) => chain.chainId === chainId)
}

/** Alerts and state stay queryable for a month, then drop off the page. */
export const ALERT_LIFETIME_DAYS = 30

export const SOURCIFY_API = "https://sourcify.dev/server"
export const SOURCIFY_USER_AGENT =
  "Tracer-UpgradeWatcher/0.1"

/**
 * Swarm evidence (optional bonus). When a Bee node is reachable, the watcher
 * uploads each alert's evidence bundle (old + new implementation bytecode and a
 * Sourcify metadata snapshot) and stores the returned bzz reference on the alert.
 * `bee dev` gives a free, usable postage stamp with no BZZ — set BEE_API_URL to it.
 * The public gateway serves the bundle back for anyone to audit.
 */
export const SWARM_GATEWAY = "https://api.gateway.ethswarm.org"
/** Links an evidence reference to a human-readable gateway URL. */
export const swarmUrl = (reference: string) => `${SWARM_GATEWAY}/bytes/${reference}`

/**
 * The proxies the watcher tracks. These are high-value mainnet proxies whose
 * implementation can be swapped by an admin — exactly where an upgrade to
 * unverified code is a red flag. The watcher reads both the EIP-1967 slot and
 * the legacy OpenZeppelin slot, so USDC (legacy) and Aave/Compound (EIP-1967)
 * are all covered.
 */
export const WATCHLIST = [
  { name: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  { name: "Aave V3 Pool", address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" },
  { name: "Compound III cUSDCv3", address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3" },
  { name: "Compound III cWETHv3", address: "0xA17581A9E3356d9A858b789D68B4d866e593aE94" },
] as const