import "dotenv/config"
import { ExpirationTime } from "@arkiv-network/sdk"
import { asc, eq } from "@arkiv-network/sdk/query"
import { addr, u64 } from "@arkiv-network/sdk/schema"
import { parseEther } from "viem"
import {
  AETHERA_LISTING,
  AETHERA_PRICING,
  LISTING_LIFETIME_DAYS,
  READING_LIFETIME_DAYS,
} from "./config"
import { aetheraLive, fetchReadings } from "./lib/aethera/aethera"
import { computeDataPower } from "./lib/marketplace/pricing"
import { fitStr } from "./lib/util/fit-str"
import { arkivClients } from "./lib/arkiv/write-checks"
import { AetheraReadings, Attestations, Listings } from "./schema"
import type { SolarReading } from "./types/aethera"

const BATCH = 8
const centi = (value: number) => u64(BigInt(Math.max(0, Math.round(value * 100))))

function readingValues(r: SolarReading) {
  return {
    site: fitStr(r.site),
    lat: fitStr(r.lat.toFixed(4)),
    lon: fitStr(r.lon.toFixed(4)),
    dniCenti: centi(r.dni),
    ghiCenti: centi(r.ghi),
    latTiltCenti: centi(r.latTilt),
    observedAt: u64(BigInt(r.observedAt)),
    txHash: fitStr(r.txHash),
    oracleAddress: fitStr(r.oracleAddress),
  }
}

async function writeReadings(clients: ReturnType<typeof arkivClients>, readings: SolarReading[]) {
  const expiration = ExpirationTime.fromDays(READING_LIFETIME_DAYS)
  const creates = readings.map((r) => ({
    schema: AetheraReadings,
    values: readingValues(r),
    expiration,
  }))
  let total = 0
  for (let i = 0; i < creates.length; i += BATCH) {
    const slice = creates.slice(i, i + BATCH)
    const result = await clients.walletClient.executeBatch({ creates: slice })
    total += slice.length
    console.log(`  wrote ${slice.length} readings in ${result.txHash}`)
  }
  console.log(`attested ${total} readings on Arkiv (source: ${aetheraLive() ? "live Aethera" : "bundled Aethera snapshot"})`)
}

async function ensureListing(clients: ReturnType<typeof arkivClients>, priceTgml: number) {
  const owner = clients.account.address
  const block = await clients.publicClient.getBlockNumber()
  const existing = await clients.publicClient
    .select({ $key: true })
    .from(Listings)
    .ownedBy(owner)
    .where(eq("category", AETHERA_LISTING.category))
    .orderBy(asc("$key"))
    .limit(1)
    .fetch()

  let listingKey = existing.entities[0]?.$key
  if (listingKey) {
    console.log(`listing already exists (${listingKey})`)
  } else {
    const result = await clients.walletClient.createEntity(
      Listings,
      {
        kind: AETHERA_LISTING.kind,
        title: fitStr(AETHERA_LISTING.title),
        summary: fitStr(AETHERA_LISTING.summary),
        category: fitStr(AETHERA_LISTING.category),
        priceWei: parseEther(priceTgml.toString()).toString(),
        seller: addr(owner),
        payTo: addr(owner),
        preview: fitStr(AETHERA_LISTING.preview),
        status: "active",
        createdBlock: u64(block),
      },
      { expiration: ExpirationTime.fromDays(LISTING_LIFETIME_DAYS) },
    )
    listingKey = result.entityKey
    console.log(`created Aethera listing ${listingKey} in ${result.txHash}`)
  }

  // Solar readings carry per-record Aptos proofs — verified first-party.
  await clients.walletClient.createEntity(
    Attestations,
    {
      listingKey,
      tier: "verified",
      verifiedBy: addr(owner),
      detail: fitStr("first-party solar oracle: each reading carries an Aptos tx proof"),
      block: u64(block),
    },
    { expiration: ExpirationTime.fromDays(LISTING_LIFETIME_DAYS) },
  )
  console.log(`  attested [verified]`)
}

async function main() {
  const clients = arkivClients()
  console.log(`seeding Aethera data as ${clients.account.address}`)
  const readings = await fetchReadings()

  // Price is computed from the data itself, not hardcoded.
  const TX_RE = /^0x[0-9a-fA-F]{64}$/
  const power = computeDataPower(
    readings.map((r) => ({
      observedAt: r.observedAt,
      group: r.site,
      completeness: [r.dni, r.ghi, r.latTilt].filter((v) => v > 0).length / 3,
      proven: TX_RE.test(r.txHash),
    })),
    AETHERA_PRICING,
  )
  console.log(`Data Power ${power.dpi}× → price ${power.priceTgml} tGLM`, power.factors)

  await writeReadings(clients, readings)
  await ensureListing(clients, power.priceTgml)
  console.log("done")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
