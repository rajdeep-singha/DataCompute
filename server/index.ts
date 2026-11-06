import "dotenv/config"
import express, { type NextFunction, type Request, type Response } from "express"
import { BaseError, HttpRequestError, TimeoutError } from "viem"
import { WATCHLIST } from "../src/config"
import { runWatch } from "../src/lib/alerts/watcher"
import { createListing, hasPurchased, relayerAddress, settlePurchase } from "./relayer"
import { getPayload, savePayload } from "./store"

const app = express()
app.use(express.json({ limit: "1mb" }))

// Same-origin in dev via the Vite proxy; permissive here so direct calls also work.
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type")
  next()
})
app.options(/.*/, (_req, res) => res.sendStatus(204))

/** Wraps an async handler so thrown errors become clean 400s. */
function handler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, relayer: relayerAddress })
})

// Seller publishes a listing. The gated payload is stored off Arkiv; only the
// public metadata is written on-chain.
app.post(
  "/api/listings",
  handler(async (req, res) => {
    const created = await createListing(req.body)
    await savePayload(created.listingKey, String(req.body.payload))
    res.json(created)
  }),
)

// Buyer redeems a confirmed on-chain payment for the gated content.
app.post(
  "/api/purchases",
  handler(async (req, res) => {
    const { listingKey, buyer, txHash, subject } = req.body ?? {}
    const payload = await getPayload(listingKey)
    const receipt = await settlePurchase({ listingKey, buyer, txHash, subject, payload })
    res.json(receipt)
  }),
)

// Re-reveal a data payload to a wallet that already owns the listing.
app.get(
  "/api/payload",
  handler(async (req, res) => {
    const listingKey = String(req.query.listingKey ?? "")
    const buyer = String(req.query.buyer ?? "")
    if (!(await hasPurchased(listingKey, buyer))) {
      res.status(403).json({ error: "no confirmed purchase for this wallet" })
      return
    }
    res.json({ payload: await getPayload(listingKey) })
  }),
)

// The watcher and the diamond check both write as the server's wallet, so only
// one of them runs at a time to keep its transaction nonces in order.
let writerBusy: string | null = null

async function exclusive<T>(name: string, res: Response, fn: () => Promise<T>) {
  if (writerBusy) {
    res.status(409).json({ error: `${writerBusy} is already running, try again when it finishes` })
    return
  }
  writerBusy = name
  try {
    res.json(await fn())
  } finally {
    writerBusy = null
  }
}

app.post(
  "/api/watch",
  handler(async (req, res) => {
    const simulate = req.body?.simulate ? String(req.body.simulate) : undefined
    if (simulate && !WATCHLIST.some((item) => item.name.toLowerCase() === simulate.toLowerCase())) {
      throw new Error(`simulate must be one of: ${WATCHLIST.map((item) => item.name).join(", ")}`)
    }
    await exclusive("a watcher pass", res, () => runWatch({ simulate, log: console.log }))
  }),
)

// viem error text embeds the RPC URL, which carries ARKIV_ACCESS_KEY; never send it to the browser.
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
  console.log(`DataVerify relayer on http://localhost:${port}`)
  console.log(`writing Arkiv entities as ${relayerAddress}`)
})
