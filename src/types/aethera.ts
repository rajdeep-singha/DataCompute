/**
 * One solar reading from the Aethera oracle. Mirrors Aethera's own snapshot
 * shape: NREL annual-average irradiance (kWh/m²/day) for a location, pushed
 * on-chain to Aptos — the `txHash` is that on-chain proof.
 */
export type SolarReading = {
  /** Human label, e.g. "San Francisco, CA". */
  site: string
  lat: number
  lon: number
  /** Direct Normal Irradiance, kWh/m²/day. */
  dni: number
  /** Global Horizontal Irradiance, kWh/m²/day. */
  ghi: number
  /** Latitude-tilt irradiance, kWh/m²/day. */
  latTilt: number
  /** Observation time, unix seconds. */
  observedAt: number
  /** Aptos transaction that recorded this reading on-chain (the source proof). */
  txHash: string
  /** Aptos oracle module address that signed it. */
  oracleAddress: string
  network: string
}

/** A provenance row as stored on and read back from Arkiv. */
export type ReadingRow = {
  key: `0x${string}`
  owner: `0x${string}`
  site: string
  lat: string
  lon: string
  /** Irradiance values ×100 (integers on Arkiv), as Aethera encodes them. */
  dniCenti: bigint
  ghiCenti: bigint
  latTiltCenti: bigint
  observedAt: bigint
  txHash: string
  oracleAddress: string
}
