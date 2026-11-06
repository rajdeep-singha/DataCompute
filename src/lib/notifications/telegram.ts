import { createHash } from "node:crypto"
import { resolve } from "node:path"
import { Outbox, type Delivery } from "./outbox"

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim())
}

export async function sendTelegram(token: string, chatId: string, text: string, request: typeof fetch = fetch): Promise<Delivery> {
  try {
    const response = await request(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = await response.json().catch(() => ({})) as { ok?: boolean; error_code?: number; parameters?: { retry_after?: number } }
    if (response.ok && body.ok === true) return { ok: true }
    const code = body.error_code ?? response.status
    const retry = body.parameters?.retry_after
    return {
      ok: false, code: `telegram_${code}`,
      permanent: code >= 400 && code < 500 && code !== 429 && code !== 408,
      retryAfterMs: typeof retry === "number" && retry > 0 ? retry * 1000 : undefined,
    }
  } catch {
    // Fetch errors can contain the URL/token. Never persist or log raw errors.
    return { ok: false, code: "network_or_invalid_response" }
  }
}

let outbox: Outbox | undefined
export function telegramOutbox(): Outbox | undefined {
  if (!telegramConfigured()) return undefined
  if (!outbox) {
    const token = process.env.TELEGRAM_BOT_TOKEN!.trim()
    const chat = process.env.TELEGRAM_CHAT_ID!.trim()
    const destination = `${token.split(":")[0]}:${chat}`
    outbox = new Outbox(resolve(process.env.TELEGRAM_OUTBOX_PATH || "data/telegram.sqlite"), destination,
      (text) => sendTelegram(token, chat, text))
  }
  return outbox
}

export function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function recordNotification(fn: (queue: Outbox) => void) {
  try { const queue = telegramOutbox(); if (queue) fn(queue) }
  catch { console.error("Telegram: could not persist notification; check outbox storage permissions and disk space.") }
}

export async function flushTelegram() {
  try { await telegramOutbox()?.tick() }
  catch { console.error("Telegram: delivery worker failed; pending messages remain on disk.") }
}

/** Server keeps retries alive independently of checks and browser tabs. */
export function startTelegramWorker() {
  if (!telegramConfigured()) return () => {}
  void flushTelegram()
  const timer = setInterval(() => void flushTelegram(), 1500)
  timer.unref()
  return () => clearInterval(timer)
}

export function dashboardLink(path: string) {
  const base = process.env.PUBLIC_APP_URL
  if (!base) return ""
  try {
    const url = new URL(path, base)
    return ["https:", "http:"].includes(url.protocol) ? `Dashboard: ${url.href}` : ""
  } catch { return "" }
}
