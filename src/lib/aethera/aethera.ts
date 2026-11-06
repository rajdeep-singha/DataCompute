import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { SolarReading } from "../../types/aethera"
import sampleAggregate from "./sample-aethera.json" with { type: "json" }

/**
 * Aethera solar oracle data adapter.
 *
 * Aethera fetches NREL annual-average irradiance (DNI/GHI/lat-tilt, kWh/m²/day)
 * for each location, pushes it on-chain to Aptos, and writes aggregated JSON
 * snapshots (`oracle-data-<ts>.json`). This adapter reads those snapshots:
 *
 *  - If AETHERA_DATA_DIR points at Aethera's `server/data` folder, the newest
 *    aggregated snapshot there is used — real, live output from your oracle.
 *  - Otherwise a real snapshot bundled with this repo is used, so the demo
 *    always runs on genuine Aethera values (San Francisco, New York, Phoenix).
 */

/** Known site labels for Aethera's configured locations. */
const SITE_LABELS: Array<{ lat: number; lon: number; name: string }> = [
  { lat: 37.7749, lon: -122.4194, name: "San Francisco, CA" },
  { lat: 40.7128, lon: -74.006, name: "New York City, NY" },
  { lat: 33.4484, lon: -112.074, name: "Phoenix, AZ" },
]

function labelFor(lat: number, lon: number): string {
  const match = SITE_LABELS.find((s) => Math.abs(s.lat - lat) < 0.01 && Math.abs(s.lon - lon) < 0.01)
  return match?.name ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

type AetheraSnapshot = {
  network?: string
  locations: Array<{
    location: { lat: number; lon: number }
    solar: { dni: number; ghi: number; lat_tilt: number }
    metadata: { timestamp: number; tx_hash: string; oracle_address: string }
  }>
}

function mapSnapshot(snapshot: AetheraSnapshot): SolarReading[] {
  const network = snapshot.network ?? "testnet"
  return snapshot.locations.map((entry) => ({
    site: labelFor(entry.location.lat, entry.location.lon),
    lat: entry.location.lat,
    lon: entry.location.lon,
    dni: entry.solar.dni,
    ghi: entry.solar.ghi,
    latTilt: entry.solar.lat_tilt,
    observedAt: entry.metadata.timestamp,
    txHash: entry.metadata.tx_hash,
    oracleAddress: entry.metadata.oracle_address,
    network,
  }))
}

/** Reads the newest aggregated snapshot from Aethera's data directory, if configured. */
async function readLiveSnapshot(): Promise<AetheraSnapshot | null> {
  const dir = process.env.AETHERA_DATA_DIR?.trim()
  if (!dir) return null
  try {
    const files = (await readdir(dir))
      .filter((name) => name.startsWith("oracle-data-") && name.endsWith(".json"))
      .sort()
    const newest = files.at(-1)
    if (!newest) return null
    return JSON.parse(await readFile(join(dir, newest), "utf8")) as AetheraSnapshot
  } catch {
    return null
  }
}

export function aetheraLive(): boolean {
  return Boolean(process.env.AETHERA_DATA_DIR?.trim())
}

/** All current readings across Aethera's locations. */
export async function fetchReadings(): Promise<SolarReading[]> {
  const live = await readLiveSnapshot()
  return mapSnapshot(live ?? (sampleAggregate as AetheraSnapshot))
}

// Resolve the bundled fixture path, so callers can reference it if needed.
export const SAMPLE_PATH = fileURLToPath(new URL("./sample-aethera.json", import.meta.url))
