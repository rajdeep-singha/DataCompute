export const SEVERITIES = ["critical", "warning", "info"] as const
export type Severity = (typeof SEVERITIES)[number]

export const VERIFIED_STATES = ["exact_match", "match", "unverified", "unknown"] as const
export type VerifiedState = (typeof VERIFIED_STATES)[number]

/** One row the alert page renders, mapped from an Arkiv entity. */
export type AlertRow = {
  key: `0x${string}`
  owner: `0x${string}`
  expiresAt: bigint
  proxy: `0x${string}`
  proxyName: string
  oldImpl: `0x${string}`
  newImpl: `0x${string}`
  verified: string
  severity: string
  block: bigint
  detail: string
  /** Swarm bzz reference of the evidence bundle, or "" when Swarm was off. */
  evidence: string
}

export type AlertFilters = {
  severity: Severity | ""
  verified: VerifiedState | ""
  proxy: string
}

export type WatchOutcome = "unchanged" | "baseline" | "upgraded" | "simulated" | "skipped"

/** What one watcher pass did for one proxy, returned by `POST /api/watch`. */
export type WatchResult = {
  name: string
  proxy: `0x${string}`
  outcome: WatchOutcome
  implementation: `0x${string}` | null
  verified?: VerifiedState
  severity?: Severity
  txHash?: `0x${string}`
}

export type WatchRun = {
  watcher: `0x${string}`
  block: string
  swarm: boolean
  results: WatchResult[]
}

export const EMPTY_ALERT_FILTERS: AlertFilters = {
  severity: "",
  verified: "",
  proxy: "",
}
