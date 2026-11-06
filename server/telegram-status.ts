import type { TelegramStatus } from "../src/types/telegram"

/** Cache the public bot identity; never expose Telegram's raw response or errors. */
export function createTelegramStatusReader(env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch) {
  let cached: { expires: number; value: TelegramStatus } | undefined
  let pending: Promise<TelegramStatus> | undefined
  async function read(): Promise<TelegramStatus> {
    const token = env.TELEGRAM_BOT_TOKEN?.trim()
    const seconds = Number(env.MONITOR_INTERVAL_SECONDS || 60)
    const value: TelegramStatus = {
      tokenConfigured: Boolean(token), destinationConfigured: Boolean(env.TELEGRAM_CHAT_ID?.trim()),
      botUrl: null, botName: null, botVerified: false,
      monitoringEnabled: env.MONITOR_ENABLED === "true",
      intervalSeconds: Number.isFinite(seconds) && seconds >= 15 ? seconds : 60,
    }
    if (token) {
      try {
        const response = await request(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(5000) })
        const body = await response.json() as { ok?: boolean; result?: { is_bot?: boolean; username?: string; first_name?: string } }
        const username = body.result?.username
        if (response.ok && body.ok && body.result?.is_bot && typeof username === "string" && /^[a-zA-Z0-9_]{5,32}$/.test(username)) {
          value.botVerified = true
          value.botUrl = `https://t.me/${username}`
          value.botName = typeof body.result.first_name === "string" ? body.result.first_name : username
        }
      } catch { /* A network failure must not leak the URL containing the token. */ }
    }
    cached = { value, expires: Date.now() + (value.botVerified ? 60_000 : 10_000) }
    return value
  }
  return async () => {
    if (cached && cached.expires > Date.now()) return cached.value
    if (!pending) pending = read().finally(() => { pending = undefined })
    return pending
  }
}
