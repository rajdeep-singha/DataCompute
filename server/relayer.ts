import { ExpirationTime } from "@arkiv-network/sdk"
import { eq } from "@arkiv-network/sdk/query"
import { addr, key, str, u64 } from "@arkiv-network/sdk/schema"
import { getAddress, isAddress, parseEther, type Address, type Hex } from "viem"
import { fetchReadings } from "../src/lib/aethera/aethera"
import { getProvider } from "../src/lib/marketplace/providers"
import { runVerifier } from "../src/lib/marketplace/verify"
import { LISTING_LIFETIME_DAYS, READING_SCHEMA_NAME } from "../src/config"
import { buildChecks } from "../src/lib/checks/checks"
import { ethereumClient, readImplementation, readMetadata } from "../src/lib/eth/ethereum"
import { fitStr } from "../src/lib/util/fit-str"
import { arkivClients } from "../src/lib/arkiv/write-checks"
import { Attestations, Listings, Purchases } from "../src/schema"
import type { ListingDraft, ListingKind, PurchaseReceipt } from "../src/types/marketplace"

/** One shared relayer identity, funded from the Arkiv faucet. */
const clients = arkivClients()
export const relayerAddress = clients.account.address

const expiration = ExpirationTime.fromDays(LISTING_LIFETIME_DAYS)

export type CreatedListing = { listingKey: Hex; txHash: Hex; priceWei: string }

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`)
  return value.trim()
}

export async function createListing(draft: ListingDraft): Promise<CreatedListing> {
  const kind = draft.kind
  if (kind !== "data" && kind !== "compute") throw new Error("kind must be 'data' or 'compute'")
  if (!isAddress(draft.payTo)) throw new Error("payTo must be a valid address")

  const title = requireText(draft.title, "title")
  const summary = requireText(draft.summary, "summary")
  const category = requireText(draft.category, "category")
  const payload = requireText(draft.payload, kind === "data" ? "dataset body" : "capability")
  if (kind === "compute" && payload !== "verify-token") {
    throw new Error("compute listings currently support only the 'verify-token' capability")
  }

  let priceWei: bigint
  try {
    priceWei = parseEther(String(draft.priceTgml))
  } catch {
    throw new Error("price must be a number of tGLM")
  }
  if (priceWei <= 0n) throw new Error("price must be greater than zero")

  const payTo = getAddress(draft.payTo)
  const block = await clients.publicClient.getBlockNumber()

  const result = await clients.walletClient.createEntity(
    Listings,
    {
      kind,
      title: fitStr(title),
      summary: fitStr(summary),
      category: fitStr(category),
      priceWei: priceWei.toString(),
      seller: addr(payTo),
      payTo: addr(payTo),
      preview: fitStr(draft.preview || summary),
      status: "active",
      createdBlock: u64(block),
    },
    { expiration },
  )

  // Verify the seller's claim and attest the result on Arkiv — a listing is only
  // ever "verified" if the platform actually re-ran a check that passed.
  const verdict = await runVerifier(draft.proof)
  await clients.walletClient.createEntity(
    Attestations,
    {
      listingKey: result.entityKey,
      tier: verdict.tier,
      verifiedBy: addr(relayerAddress),
      detail: fitStr(verdict.detail),
      block: u64(block),
    },
    { expiration },
  )

  return { listingKey: result.entityKey, txHash: result.txHash, priceWei: priceWei.toString() }
}

type StoredListing = {
  kind: ListingKind
  category: string
  priceWei: bigint
  payTo: Address
  seller: Address
}

async function loadListing(listingKey: Hex): Promise<StoredListing> {
  const page = await clients.publicClient
    .select({
      kind: true,
      category: true,
      priceWei: true,
      payTo: true,
      seller: true,
      status: true,
    })
    .from(Listings)
    .where(eq("$key", key(listingKey)))
    .limit(1)
    .fetch()

  const row = page.entities[0]
  if (!row) throw new Error("listing not found")
  if (row.status.value !== "active") throw new Error("listing is not active")
  return {
    kind: row.kind.value as ListingKind,
    category: row.category.value,
    priceWei: BigInt(row.priceWei.value),
    payTo: getAddress(row.payTo.value),
    seller: getAddress(row.seller.value),
  }
}

async function alreadyRedeemed(txHash: string): Promise<boolean> {
  const page = await clients.publicClient
    .select({ $key: true })
    .from(Purchases)
    .where(eq("txHash", str(txHash)))
    .limit(1)
    .fetch()
  return page.entities.length > 0
}

/** Confirms the buyer's tGLM payment on Rabdi before any purchase is written. */
async function verifyPayment(txHash: Hex, listing: StoredListing, buyer: Address) {
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash: txHash })
  if (receipt.status !== "success") throw new Error("payment transaction failed on-chain")

  const tx = await clients.publicClient.getTransaction({ hash: txHash })
  if (!tx.to || getAddress(tx.to) !== listing.payTo) {
    throw new Error("payment was not sent to the seller")
  }
  if (getAddress(tx.from) !== buyer) {
    throw new Error("payment was not sent from the connected wallet")
  }
  if (tx.value < listing.priceWei) {
    throw new Error("payment is less than the listing price")
  }
}

async function runCompute(subject: Address): Promise<NonNullable<PurchaseReceipt["compute"]>> {
  const eth = ethereumClient()
  const [metadata, proxy] = await Promise.all([
    readMetadata(eth, subject),
    readImplementation(eth, subject),
  ])
  const listed = {
    chainId: 1,
    address: subject,
    name: metadata.name ?? "",
    symbol: metadata.symbol ?? "",
    decimals: metadata.decimals ?? -1,
  }
  const drafts = buildChecks(listed, metadata, proxy.implementation, proxy.hasCode)
  return {
    subject,
    results: drafts.map((draft) => ({
      check: draft.check,
      status: draft.status,
      detail: draft.detail,
    })),
  }
}

/** Fetches the full, fresh solar feed a buyer paid for across all Aethera sites. */
async function runOracle(): Promise<NonNullable<PurchaseReceipt["oracle"]>> {
  return {
    feed: "aethera-solar",
    readings: await fetchReadings(),
    provenanceSchema: READING_SCHEMA_NAME,
  }
}

export type SettleInput = {
  listingKey: Hex
  buyer: Address
  txHash: Hex
  /** Required for compute listings: the token address to verify. */
  subject?: Address
  /** The gated dataset body, looked up off Arkiv by the caller. */
  payload?: string
}

export async function settlePurchase(input: SettleInput): Promise<PurchaseReceipt> {
  if (!isAddress(input.buyer)) throw new Error("buyer must be a valid address")
  const buyer = getAddress(input.buyer)
  const listing = await loadListing(input.listingKey)

  if (await alreadyRedeemed(input.txHash)) {
    throw new Error("this payment has already been redeemed")
  }
  await verifyPayment(input.txHash, listing, buyer)

  // Provider-backed assets (research-intel, security-feed, staking-registry, rug-risk).
  const provider = getProvider(listing.category)

  let compute: PurchaseReceipt["compute"]
  if (listing.kind === "compute" && !provider) {
    if (!input.subject || !isAddress(input.subject)) {
      throw new Error("compute listings need a token address to verify")
    }
    compute = await runCompute(getAddress(input.subject))
  }

  let oracle: PurchaseReceipt["oracle"]
  if (listing.kind === "oracle") {
    oracle = await runOracle()
  }

  let dataset: PurchaseReceipt["dataset"]
  if (provider) {
    dataset = {
      category: provider.id,
      title: provider.title,
      columns: provider.columns,
      records: await provider.load(input.subject),
      provenanceNote: provider.provenanceNote,
    }
  }

  const block = await clients.publicClient.getBlockNumber()
  const purchase = await clients.walletClient.createEntity(
    Purchases,
    {
      listingKey: input.listingKey,
      buyer: addr(buyer),
      seller: addr(listing.seller),
      amountWei: listing.priceWei.toString(),
      txHash: input.txHash,
      block: u64(block),
      kind: listing.kind,
    },
    { expiration },
  )

  return {
    purchaseKey: purchase.entityKey,
    kind: listing.kind,
    payload: listing.kind === "data" ? input.payload : undefined,
    compute,
    oracle,
    dataset,
  }
}

/** Confirms a buyer already owns a listing, for re-revealing data payloads. */
export async function hasPurchased(listingKey: string, buyer: string): Promise<boolean> {
  if (!isAddress(buyer)) return false
  const page = await clients.publicClient
    .select({ $key: true })
    .from(Purchases)
    .where(eq("listingKey", str(listingKey)))
    .where(eq("buyer", addr(getAddress(buyer))))
    .limit(1)
    .fetch()
  return page.entities.length > 0
}
