import "dotenv/config"
import { ExpirationTime } from "@arkiv-network/sdk"
import { asc, eq } from "@arkiv-network/sdk/query"
import { addr, u64 } from "@arkiv-network/sdk/schema"
import { parseEther } from "viem"
import { LISTING_LIFETIME_DAYS } from "./config"
import { allProviders } from "./lib/marketplace/providers"
import { computeDataPower } from "./lib/marketplace/pricing"
import { fitStr } from "./lib/util/fit-str"
import { arkivClients } from "./lib/arkiv/write-checks"
import { Attestations, Listings } from "./schema"

async function listingExists(clients: ReturnType<typeof arkivClients>, category: string) {
  const page = await clients.publicClient
    .select({ $key: true })
    .from(Listings)
    .ownedBy(clients.account.address)
    .where(eq("category", category))
    .orderBy(asc("$key"))
    .limit(1)
    .fetch()
  return page.entities[0]?.$key
}

async function main() {
  const clients = arkivClients()
  const owner = clients.account.address
  console.log(`seeding provider listings as ${owner}`)

  for (const provider of allProviders()) {
    const block = await clients.publicClient.getBlockNumber()
    let listingKey = await listingExists(clients, provider.id)

    if (listingKey) {
      console.log(`  ${provider.id}: listing exists (${listingKey})`)
    } else {
      // Price from Data Power for datasets; compute assets price off their base.
      let priceTgml: number
      if (provider.kind === "dataset") {
        const records = await provider.load()
        priceTgml = computeDataPower(records.map(provider.toPriceItem), provider.pricing).priceTgml
      } else {
        priceTgml = provider.pricing.basePriceTgml * provider.pricing.rarity
      }

      const result = await clients.walletClient.createEntity(
        Listings,
        {
          kind: provider.kind,
          title: fitStr(provider.title),
          summary: fitStr(provider.summary),
          category: fitStr(provider.id),
          priceWei: parseEther(priceTgml.toString()).toString(),
          seller: addr(owner),
          payTo: addr(owner),
          preview: fitStr(provider.preview),
          status: "active",
          createdBlock: u64(block),
        },
        { expiration: ExpirationTime.fromDays(LISTING_LIFETIME_DAYS) },
      )
      listingKey = result.entityKey
      console.log(`  ${provider.id}: created at ${priceTgml} tGLM → ${result.txHash}`)
    }

    // Always ensure a first-party attestation exists for the listing.
    await clients.walletClient.createEntity(
      Attestations,
      {
        listingKey,
        tier: provider.trust,
        verifiedBy: addr(owner),
        detail: fitStr(`first-party asset: ${provider.provenanceNote}`),
        block: u64(block),
      },
      { expiration: ExpirationTime.fromDays(LISTING_LIFETIME_DAYS) },
    )
    console.log(`    attested [${provider.trust}]`)
  }
  console.log("done")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
