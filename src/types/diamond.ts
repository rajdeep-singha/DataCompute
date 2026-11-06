import type { Severity, VerifiedState } from "./alert"

type Hex = `0x${string}`

/** One facet as the diamond loupe reports it, plus a hash of its deployed code. */
export type FacetSnapshot = {
  address: Hex
  /** keccak256 of the facet's runtime bytecode, so a redeploy of identical code isn't a change. */
  codehash: Hex
  selectors: Hex[]
}

export type DiamondSnapshot = {
  owner: Hex | null
  block: string
  facets: FacetSnapshot[]
}

/** The reviewed, expected state of a diamond on each chain. Written by `npm run diamond:pin`. */
export type DiamondManifest = {
  diamond: string
  address: Hex
  pinnedAt: string
  chains: Record<string, DiamondSnapshot>
}

export type FindingKind =
  | "unexpected-function"
  | "missing-function"
  | "facet-code-changed"
  | "owner-changed"

/** One way a chain differs from its manifest. Function findings are grouped per facet. */
export type Finding = {
  kind: FindingKind
  selectors: Hex[]
  /** The facet that now serves the selectors (or served them, for a missing function). */
  facet: Hex | null
  /** Expected value: facet address for code changes, owner for owner changes. */
  expected: string | null
  actual: string | null
  /** Captures code changes even when the facet address stays the same. */
  actualCodehash?: Hex
  /** Sourcify status of `facet` on this chain, set for unexpected and changed facets. */
  verified?: VerifiedState
  /** Human-readable signatures for `selectors`, when known. */
  signatures?: string[]
}

export const DIAMOND_VERDICTS = ["ok", "changed", "suspicious", "unreachable", "unpinned"] as const
export type DiamondVerdict = (typeof DIAMOND_VERDICTS)[number]

export type ChainResult = {
  chainId: number
  chain: string
  verdict: DiamondVerdict
  severity: Severity
  detail: string
  findings: Finding[]
  facets: number
  selectors: number
}

/** What one diamond check run did, returned by `POST /api/diamond`. */
export type DiamondRun = {
  diamond: string
  run: string
  simulated: number | null
  txHash: Hex | null
  evidence: string
  results: ChainResult[]
}

/** One diamond.check entity as the page reads it back from Arkiv. */
export type DiamondCheckRow = {
  key: Hex
  expiresAt: bigint
  diamond: string
  chainId: bigint
  chainName: string
  address: Hex
  verdict: string
  severity: string
  run: bigint
  findings: bigint
  detail: string
  evidence: string
}
