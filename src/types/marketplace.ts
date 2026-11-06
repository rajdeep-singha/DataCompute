export const LISTING_KINDS = ["data", "compute", "oracle", "dataset"] as const
export type ListingKind = (typeof LISTING_KINDS)[number]

export const LISTING_STATUSES = ["active", "paused"] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

/** A listing's public metadata, as stored on Arkiv and read by the catalog. */
export type ListingRow = {
  key: `0x${string}`
  owner: `0x${string}`
  expiresAt: bigint
  kind: string
  title: string
  summary: string
  category: string
  priceWei: string
  seller: `0x${string}`
  payTo: `0x${string}`
  preview: string
  status: string
  createdBlock: bigint
}

/** A purchase record, written only after an on-chain payment is confirmed. */
export type PurchaseRow = {
  key: `0x${string}`
  owner: `0x${string}`
  listingKey: string
  buyer: `0x${string}`
  seller: `0x${string}`
  amountWei: string
  txHash: string
  block: bigint
  kind: string
}

/** What the seller fills in. The backend turns this into a listing entity. */
export type ListingDraft = {
  kind: ListingKind
  title: string
  summary: string
  category: string
  priceTgml: string
  payTo: `0x${string}`
  preview: string
  /** Gated content held off Arkiv: dataset body, or a compute capability id. */
  payload: string
  /** Optional proof the verifier checks: token addresses to re-check, or a tx hash. */
  proof?: string
}

/** A verifier attestation for a listing, read back from Arkiv. */
export type AttestationRow = {
  listingKey: string
  tier: string
  verifiedBy: `0x${string}`
  detail: string
}

export type ListingFilters = {
  kind: ListingKind | ""
  category: string
}

export const EMPTY_LISTING_FILTERS: ListingFilters = {
  kind: "",
  category: "",
}

/** What the backend returns once a purchase is confirmed. */
export type PurchaseReceipt = {
  purchaseKey: string
  kind: ListingKind
  /** For data listings: the unlocked dataset body. */
  payload?: string
  /** For compute listings: the freshly produced verification result. */
  compute?: {
    subject: `0x${string}`
    results: Array<{ check: string; status: string; detail: string }>
  }
  /** For oracle listings: fresh readings, plus the Arkiv query that proves them. */
  oracle?: {
    feed: string
    readings: import("./aethera").SolarReading[]
    provenanceSchema: string
  }
  /** For provider-backed dataset/compute assets: generic records + how to render them. */
  dataset?: {
    category: string
    title: string
    columns: Array<{ key: string; label: string; kind?: "text" | "num" | "url" | "mono" }>
    records: Array<Record<string, string | number>>
    provenanceNote: string
  }
}
