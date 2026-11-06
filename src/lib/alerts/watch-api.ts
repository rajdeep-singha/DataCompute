import type { WatchRun } from "../../types/alert"

/** Asks the local server to run one watcher pass. `simulate` names a watchlist proxy. */
export async function requestWatch(simulate?: string): Promise<WatchRun> {
  let res: Response
  try {
    res = await fetch("/api/watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(simulate ? { simulate } : {}),
    })
  } catch {
    throw new Error("Server isn’t running. Start it with npm run server, or use npm run dev:all.")
  }
  const body = (await res.json().catch(() => ({}))) as WatchRun & { error?: string }
  if (!res.ok) {
    // Vite's proxy answers 500/502/504 with no JSON body when the backend is down.
    const proxyError = [500, 502, 503, 504].includes(res.status) && !body.error
    if (proxyError) {
      throw new Error("Backend isn’t running. Start it in another terminal with: npm run server")
    }
    throw new Error(body.error ?? `watcher failed (${res.status})`)
  }
  return body
}
