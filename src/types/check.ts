export const CHECK_KINDS = ["erc20", "list-match", "eip1967"] as const
export type CheckKind = (typeof CHECK_KINDS)[number]

export const STATUSES = ["pass", "mismatch", "fail", "absent"] as const
export type CheckStatus = (typeof STATUSES)[number]

export type ListedToken = {
  chainId: number
  address: `0x${string}`
  name: string
  symbol: string
  decimals: number
}

export type ChainMetadata = {
  name: string | null
  symbol: string | null
  decimals: number | null
  nameError: string | null
  symbolError: string | null
  decimalsError: string | null
}

/** A check before it is written. Plain data, no Arkiv value wrappers. */
export type CheckDraft = {
  check: CheckKind
  status: CheckStatus
  implementation: `0x${string}`
  symbol: string
  name: string
  decimals: number
  detail: string
}

/** One row the UI renders. Mapped from an Arkiv entity at the query boundary. */
export type CheckRow = {
  key: `0x${string}`
  owner: `0x${string}`
  expiresAt: bigint
  chainId: bigint
  subject: `0x${string}`
  check: string
  status: string
  block: bigint
  implementation: `0x${string}`
  symbol: string
  name: string
  decimals: number
  detail: string
}

export type CheckFilters = {
  status: CheckStatus | ""
  check: CheckKind | ""
  symbol: string
  subject: string
}

export const EMPTY_FILTERS: CheckFilters = {
  status: "",
  check: "",
  symbol: "",
  subject: "",
}
