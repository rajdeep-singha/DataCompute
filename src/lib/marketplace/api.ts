import type { ListingDraft, PurchaseReceipt } from "../../types/marketplace"

/** Calls to the relayer backend, proxied under /api by Vite. */

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `request failed (${res.status})`)
  return data as T
}

export type CreatedListing = { listingKey: `0x${string}`; txHash: `0x${string}`; priceWei: string }

export function createListing(draft: ListingDraft): Promise<CreatedListing> {
  return post<CreatedListing>("/api/listings", draft)
}

export type PurchaseInput = {
  listingKey: string
  buyer: `0x${string}`
  txHash: `0x${string}`
  subject?: `0x${string}`
}

export function settlePurchase(input: PurchaseInput): Promise<PurchaseReceipt> {
  return post<PurchaseReceipt>("/api/purchases", input)
}

/** Re-reveal a data payload to a wallet that already owns the listing. */
export async function fetchPayload(listingKey: string, buyer: string): Promise<string> {
  const params = new URLSearchParams({ listingKey, buyer })
  const res = await fetch(`/api/payload?${params}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `request failed (${res.status})`)
  return (data as { payload?: string }).payload ?? ""
}
