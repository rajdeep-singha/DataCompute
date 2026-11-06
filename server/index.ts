import "dotenv/config"
import express, { type NextFunction, type Request, type Response } from "express"
import { BaseError, HttpRequestError, TimeoutError } from "viem"
import { WATCHLIST } from "../src/config"
import { runWatch } from "../src/lib/alerts/watcher"

const app = express()
app.use(express.json({ limit: "1mb" }))

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type")
  next()
})
app.options(/.*/, (_req, res) => res.sendStatus(204))

function handler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true })
})

let watchRunning = false
app.post(
  "/api/watch",
  handler(async (req, res) => {
    const simulate = req.body?.simulate ? String(req.body.simulate) : undefined
    if (simulate && !WATCHLIST.some((item) => item.name.toLowerCase() === simulate.toLowerCase())) {
      throw new Error(`simulate must be one of: ${WATCHLIST.map((item) => item.name).join(", ")}`)
    }
    if (watchRunning) {
      res.status(409).json({ error: "a watcher pass is already running" })
      return
    }
    watchRunning = true
    try {
      res.json(await runWatch({ simulate, log: console.log }))
    } finally {
      watchRunning = false
    }
  }),
)

function publicMessage(err: unknown): string {
  if (err instanceof TimeoutError || err instanceof HttpRequestError) {
    return "Arkiv testnet RPC didn't respond in time. It's usually a short stall, so try again in a moment."
  }
  const raw = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : "request failed"
  const accessKey = process.env.ARKIV_ACCESS_KEY
  return accessKey ? raw.split(accessKey).join("<access-key>") : raw
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = publicMessage(err)
  console.error(message)
  res.status(400).json({ error: message })
})

const port = Number(process.env.PORT ?? 8787)
app.listen(port, () => {
  console.log(`DataVerify watcher on http://localhost:${port}`)
})
