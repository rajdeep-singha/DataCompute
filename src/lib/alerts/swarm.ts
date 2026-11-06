/**
 * Minimal Swarm (Bee) client over the Bee HTTP API, no SDK dependency.
 *
 * The watcher uploads an evidence bundle per alert; the bzz reference it returns
 * is stored on the Arkiv entity, and the public gateway serves the bundle back.
 *
 * Point BEE_API_URL at a Bee node. The easiest is dev mode, which hands out a
 * free, immediately-usable postage stamp (no BZZ needed):
 *
 *     bee dev
 *     BEE_API_URL=http://localhost:1633 npm run watch
 *
 * When BEE_API_URL is unset or the node is unreachable, uploads are skipped and
 * the alert is written with an empty evidence reference — the app still works.
 */

type StampList = { stamps?: Array<{ batchID: string; usable?: boolean }> }
type BytesResponse = { reference?: string }

function apiUrl(): string | null {
  const raw = process.env.BEE_API_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, "")
}

export function swarmEnabled(): boolean {
  return apiUrl() !== null
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) throw new Error(`Bee ${res.status}: ${(await res.text()).slice(0, 120)}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** Finds a usable postage batch, buying one if none exists (instant & free in dev mode). */
async function usableStamp(api: string): Promise<string> {
  const list = await fetchJson<StampList>(`${api}/stamps`)
  const existing = list.stamps?.find((s) => s.usable)
  if (existing) return existing.batchID
  // amount/depth: small values are fine in dev mode; depth 17 is the practical minimum.
  const bought = await fetchJson<{ batchID: string }>(`${api}/stamps/10000000/17`, { method: "POST" })
  return bought.batchID
}

/**
 * Uploads bytes to Swarm and returns the bzz reference, or null if Swarm is off
 * or unreachable. Never throws — evidence is a bonus, not a hard dependency.
 */
export async function uploadToSwarm(data: Uint8Array | string): Promise<string | null> {
  const api = apiUrl()
  if (!api) return null
  try {
    const batchID = await usableStamp(api)
    const body = typeof data === "string" ? new TextEncoder().encode(data) : data
    const res = await fetch(`${api}/bytes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "swarm-postage-batch-id": batchID,
      },
      body: body as BodyInit,
    })
    if (!res.ok) throw new Error(`Bee ${res.status}: ${(await res.text()).slice(0, 120)}`)
    const json = (await res.json()) as BytesResponse
    return json.reference ?? null
  } catch (error) {
    console.warn(`  swarm upload skipped: ${error instanceof Error ? error.message : error}`)
    return null
  }
}
