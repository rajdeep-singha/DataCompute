import { useEffect, useState } from "react"
import { AETHERA_PRICING } from "../config"
import { readRecentReadings } from "../lib/aethera/read-readings"
import { browserClient } from "../lib/arkiv/read-checks"
import { computeDataPower, type DataPower, type PriceItem } from "../lib/marketplace/pricing"
import type { ReadingRow } from "../types/aethera"

const client = browserClient()
const TX_RE = /^0x[0-9a-fA-F]{64}$/

/** Maps a solar reading to a Data-Power item: grouped by site, proven by its Aptos tx. */
export function solarPriceItem(r: ReadingRow): PriceItem {
  const present = [r.dniCenti, r.ghiCenti, r.latTiltCenti].filter((v) => Number(v) > 0).length
  return {
    observedAt: Number(r.observedAt),
    group: r.site,
    completeness: present / 3,
    proven: TX_RE.test(r.txHash),
  }
}

type Snapshot = { readings: ReadingRow[]; power: DataPower | null }

// Module-level cache so the marketplace card and the Docs page share one fetch
// instead of each querying Arkiv. Short TTL keeps it fresh enough for a feed.
const TTL_MS = 30_000
let cache: { at: number; promise: Promise<Snapshot> } | null = null

function load(): Promise<Snapshot> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.promise
  const promise = readRecentReadings(client, { limit: 48 }).then((readings) => {
    const power = readings.length === 0 ? null : computeDataPower(readings.map(solarPriceItem), AETHERA_PRICING)
    return { readings, power }
  })
  cache = { at: Date.now(), promise }
  // Drop a failed fetch from the cache so the next caller retries.
  promise.catch(() => {
    if (cache?.promise === promise) cache = null
  })
  return promise
}

/** Shared Aethera readings + their Data Power price, fetched once and cached. */
export function useDataPower(): Snapshot & { loading: boolean } {
  const [snapshot, setSnapshot] = useState<Snapshot>({ readings: [], power: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    load()
      .then((s) => {
        if (!cancelled) setSnapshot(s)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { ...snapshot, loading }
}
