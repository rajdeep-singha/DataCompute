import { desc, eq } from "@arkiv-network/sdk/query"
import { AetheraReadings } from "../../schema"
import type { ReadingRow } from "../../types/aethera"
import { browserClient } from "../arkiv/read-checks"

type Reader = ReturnType<typeof browserClient>

const SELECTION = {
  $key: true,
  $owner: true,
  site: true,
  lat: true,
  lon: true,
  dniCenti: true,
  ghiCenti: true,
  latTiltCenti: true,
  observedAt: true,
  txHash: true,
  oracleAddress: true,
} as const

/** Public provenance: the most recent attested readings, newest first. */
export async function readRecentReadings(
  client: Reader,
  options: { site?: string; limit?: number } = {},
): Promise<ReadingRow[]> {
  let query = client
    .select(SELECTION)
    .from(AetheraReadings)
    .orderBy(desc("observedAt"))
    .limit(options.limit ?? 24)
  if (options.site) query = query.where(eq("site", options.site))

  const page = await query.fetch()
  return page.entities.map((row) => ({
    key: row.$key,
    owner: row.$owner,
    site: row.site.value,
    lat: row.lat.value,
    lon: row.lon.value,
    dniCenti: row.dniCenti.value,
    ghiCenti: row.ghiCenti.value,
    latTiltCenti: row.latTiltCenti.value,
    observedAt: row.observedAt.value,
    txHash: row.txHash.value,
    oracleAddress: row.oracleAddress.value,
  }))
}
