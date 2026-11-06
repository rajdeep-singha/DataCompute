import "dotenv/config"
import express, { type NextFunction, type Request, type Response } from "express"
import { BaseError, getAddress, HttpRequestError, isAddress, TimeoutError } from "viem"
import { WATCHLIST } from "../src/config"
import { runWatch } from "../src/lib/alerts/watcher"
import { runDiamondCheck } from "../src/lib/diamond/check"
import { createListing, hasPurchased, relayerAddress, settlePurchase } from "./relayer"
import { getPayload, savePayload } from "./store"
import { timingSafeEqual } from "node:crypto"
import { notifyProxy } from "../src/lib/notifications/events"
import { startTelegramWorker, telegramConfigured } from "../src/lib/notifications/telegram"
import { startMonitor } from "./monitor"
import { createTelegramStatusReader } from "./telegram-status"

const app = express()
app.use(express.json({ limit: "1mb" }))

// Same-origin in dev via the Vite proxy; permissive here so direct calls also work.
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization")
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

const readTelegramStatus = createTelegramStatusReader()
app.get("/api/telegram/status", handler(async (_req, res) => {
  res.setHeader("Cache-Control", "no-store")
  res.json(await readTelegramStatus())
}))

function allowedOrigin(req: Request) {
  const origin = req.headers.origin
  if (!origin) return true
  const allowed = [process.env.PUBLIC_APP_URL, "http://localhost:5173", "http://127.0.0.1:5173"]
    .filter((value): value is string => Boolean(value))
  return allowed.some((value) => { try { return new URL(value).origin === origin } catch { return false } })
}

// Same moment as the in-app alert: a new critical upgrade. Deduped by implementation,
// so a repeat poll or a watcher pass does not send the message twice.
app.post("/api/telegram/alert", handler(async (req, res) => {
  if (!allowedOrigin(req)) {
    res.status(403).json({ error: "This origin cannot send alerts." })
    return
  }
  const body = req.body ?? {}
  if (body.severity !== "critical") {
    res.json({ ok: true, sent: false })
    return
  }
  if (!isAddress(body.proxy) || !isAddress(body.oldImpl) || !isAddress(body.newImpl)) {
    throw new Error("proxy, oldImpl, and newImpl must be addresses")
  }
  const block = BigInt(body.block)
  notifyProxy({
    proxy: getAddress(body.proxy),
    name: String(body.name ?? "proxy").replace(/[\r\n]/g, " ").slice(0, 80),
    oldImpl: getAddress(body.oldImpl),
    newImpl: getAddress(body.newImpl),
    block,
    verified: String(body.verified ?? "unknown").replace(/[\r\n]/g, " ").slice(0, 40),
    severity: "critical",
  })
  res.json({ ok: true, sent: telegramConfigured() })
}))

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
let nextCheckAt = 0

// One operator credential, server-side only; protects both real and simulated runs.
app.use(["/api/watch", "/api/diamond"], (req, res, next) => {
  const origin = req.headers.origin
  if (origin) {
    const allowed = [process.env.PUBLIC_APP_URL, "http://localhost:5173", "http://127.0.0.1:5173"]
      .filter((value): value is string => Boolean(value))
    if (!allowed.some((value) => { try { return new URL(value).origin === origin } catch { return false } })) {
      res.status(403).json({ error: "This origin cannot trigger checks. Configure PUBLIC_APP_URL for your dashboard." })
      return
    }
  }
  const token = process.env.WATCH_API_TOKEN
  if (token) {
    const provided = Buffer.from(req.headers.authorization ?? "")
    const expected = Buffer.from(`Bearer ${token}`)
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      res.status(401).json({ error: "An operator token is required to run checks." })
      return
    }
  }
  if (Date.now() < nextCheckAt) {
    res.setHeader("Retry-After", Math.ceil((nextCheckAt - Date.now()) / 1000))
    res.status(429).json({ error: "Please wait a few seconds before running another check." })
    return
  }
  nextCheckAt = Date.now() + 10_000
  next()
})

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

app.post(
  "/api/diamond",
  handler(async (req, res) => {
    const diamond = String(req.body?.diamond ?? "")
    const raw = req.body?.simulate
    const simulate = raw === undefined || raw === null || raw === "" ? undefined : Number(raw)
    if (simulate !== undefined && !Number.isInteger(simulate)) throw new Error("simulate must be a chain id")
    await exclusive("a diamond check", res, () => runDiamondCheck({ diamondId: diamond, simulate, log: console.log }))
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
const host = process.env.HOST || "127.0.0.1"
if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1" && !process.env.WATCH_API_TOKEN) {
  throw new Error("Set WATCH_API_TOKEN before exposing the server on a non-loopback HOST.")
}
const stopTelegram = startTelegramWorker()
const stopMonitor = startMonitor(async (name, fn) => {
  if (writerBusy) return
  writerBusy = name
  try { await fn() } finally { writerBusy = null }
})
const server = app.listen(port, host, () => {
  console.log(`DataVerify relayer on http://localhost:${port}`)
  console.log(`writing Arkiv entities as ${relayerAddress}`)
  console.log(`Telegram delivery ${telegramConfigured() ? "enabled" : "disabled (configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)"}`)
})
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stopMonitor()
    stopTelegram()
    server.close()
    // Bound shutdown if an RPC or keep-alive connection is stuck.
    setTimeout(() => process.exit(0), 15_000).unref()
  })
}
