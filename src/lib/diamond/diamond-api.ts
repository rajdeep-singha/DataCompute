import type { DiamondRun } from "../../types/diamond"
import { operatorFetch } from "../alerts/operator-fetch"

/** Asks the local server to check one diamond. `simulate` is a chain id to plant a fake malicious facet on. */
export async function requestDiamondCheck(diamond: string, simulate?: number): Promise<DiamondRun> {
  let res: Response
  try {
    res = await operatorFetch("/api/diamond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(simulate === undefined ? { diamond } : { diamond, simulate }),
    })
  } catch {
    throw new Error("Server isn’t running. Start it with npm run server, or use npm run dev:all.")
  }
  const body = (await res.json().catch(() => ({}))) as DiamondRun & { error?: string }
  if (!res.ok) {
    // Vite's proxy answers 500/502/504 with no JSON body when the backend is down.
    const proxyError = [500, 502, 503, 504].includes(res.status) && !body.error
    if (proxyError) {
      throw new Error("Backend isn’t running. Start it in another terminal with: npm run server")
    }
    throw new Error(body.error ?? `diamond check failed (${res.status})`)
  }
  return body
}
