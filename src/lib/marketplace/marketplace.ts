import { asc, desc, eq } from "@arkiv-network/sdk/query"
import { addr } from "@arkiv-network/sdk/schema"
import { isAddress, type Address } from "viem"
import { Attestations, Listings, Purchases } from "../../schema"
import type { AttestationRow, ListingFilters, ListingRow, PurchaseRow } from "../../types/marketplace"
import { browserClient } from "../arkiv/read-checks"

type Reader = ReturnType<typeof browserClient>

const LISTING_SELECTION = {
  $key: true,
  $owner: true,
  $expiresAt: true,
  kind: true,
  title: true,
  summary: true,
  category: true,
  priceWei: true,
  seller: true,
  payTo: true,
  preview: true,
  status: true,
  createdBlock: true,
} as const

const PURCHASE_SELECTION = {
  $key: true,
  $owner: true,
  listingKey: true,
  buyer: true,
  seller: true,
  amountWei: true,
  txHash: true,
  block: true,
  kind: true,
} as const

export async function readListings(
  client: Reader,
  filters: ListingFilters,
): Promise<{ rows: ListingRow[]; blockNumber: bigint }> {
  let query = client
    .select(LISTING_SELECTION)
    .from(Listings)
    .where(eq("status", "active"))
    .orderBy(asc("$key"))
    .limit(100)

  if (filters.kind) query = query.where(eq("kind", filters.kind))
  if (filters.category.trim()) query = query.where(eq("category", filters.category.trim()))

  const page = await query.fetch()
  const rows: ListingRow[] = page.entities.map((row) => ({
    key: row.$key,
    owner: row.$owner,
    expiresAt: row.$expiresAt,
    kind: row.kind.value,
    title: row.title.value,
    summary: row.summary.value,
    category: row.category.value,
    priceWei: row.priceWei.value,
    seller: row.seller.value,
    payTo: row.payTo.value,
    preview: row.preview.value,
    status: row.status.value,
    createdBlock: row.createdBlock.value,
  }))
  return { rows, blockNumber: page.blockNumber }
}

/** Verifier attestations, keyed by listing key, newest-first so the latest wins. */
export async function readAttestations(client: Reader): Promise<Map<string, AttestationRow>> {
  const page = await client
    .select({ listingKey: true, tier: true, verifiedBy: true, detail: true })
    .from(Attestations)
    .orderBy(desc("block"))
    .limit(100)
    .fetch()
  const map = new Map<string, AttestationRow>()
  for (const row of page.entities) {
    const listingKey = row.listingKey.value
    if (map.has(listingKey)) continue // first (newest) wins
    map.set(listingKey, {
      listingKey,
      tier: row.tier.value,
      verifiedBy: row.verifiedBy.value,
      detail: row.detail.value,
    })
  }
  return map
}

/** Purchases a given buyer has made, so the UI can show already-unlocked listings. */
export async function readPurchases(client: Reader, buyer: string): Promise<PurchaseRow[]> {
  if (!isAddress(buyer)) return []
  const page = await client
    .select(PURCHASE_SELECTION)
    .from(Purchases)
    .where(eq("buyer", addr(buyer as Address)))
    .orderBy(asc("$key"))
    .limit(100)
    .fetch()
  return page.entities.map((row) => ({
    key: row.$key,
    owner: row.$owner,
    listingKey: row.listingKey.value,
    buyer: row.buyer.value,
    seller: row.seller.value,
    amountWei: row.amountWei.value,
    txHash: row.txHash.value,
    block: row.block.value,
    kind: row.kind.value,
  }))
}
