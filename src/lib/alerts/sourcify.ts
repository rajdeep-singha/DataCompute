import type { Address } from "viem"
import { SOURCIFY_API, SOURCIFY_USER_AGENT } from "../../config"

/**
 * Whether an implementation's source is verified, straight from Sourcify.
 * - `exact_match` — bytecode and metadata match exactly (fully verified)
 * - `match`       — a partial match (verified, minor metadata differences)
 * - `unverified`  — Sourcify has no match for this address (the red flag)
 * - `unknown`     — Sourcify could not be reached; we don't claim either way
 */
export type VerifiedStatus = "exact_match" | "match" | "unverified" | "unknown"

type V2Response = {
  match?: string | null
  creationMatch?: string | null
  runtimeMatch?: string | null
}

/** Normalizes Sourcify's match fields into our four-state verdict. */
function verdict(body: V2Response): VerifiedStatus {
  const signals = [body.match, body.creationMatch, body.runtimeMatch]
  if (signals.some((s) => s === "exact_match" || s === "perfect")) return "exact_match"
  if (signals.some((s) => s === "match" || s === "partial")) return "match"
  if (signals.every((s) => s === null || s === undefined)) return "unverified"
  return "match"
}

export async function checkVerified(
  address: Address,
  chainId = 1,
  timeoutMs = 12_000,
): Promise<VerifiedStatus> {
  const url = `${SOURCIFY_API}/v2/contract/${chainId}/${address}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": SOURCIFY_USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    })
    // A 404 means Sourcify positively has no record — that is "unverified", not an error.
    if (res.status === 404) return "unverified"
    if (!res.ok) return "unknown"
    const body = (await res.json()) as V2Response
    return verdict(body)
  } catch {
    return "unknown"
  } finally {
    clearTimeout(timer)
  }
}
