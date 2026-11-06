export type TelegramChat = { id: number; type: string; title?: string }
type Update = { message?: { chat?: TelegramChat }; channel_post?: { chat?: TelegramChat }; my_chat_member?: { chat?: TelegramChat } }

/** Read-only discovery: never sends messages, removes webhooks or acknowledges updates. */
export async function discoverTelegramChats(token: string, announce: (line: string) => void = console.log, request: typeof fetch = fetch) {
  async function call<T>(method: string, query = ""): Promise<T> {
    let response: Response
    let body: { ok?: boolean; error_code?: number; result?: T }
    try {
      response = await request(`https://api.telegram.org/bot${token}/${method}${query}`, { signal: AbortSignal.timeout(25_000) })
      body = await response.json()
    } catch { throw new Error("Could not reach Telegram. Check your internet connection and try again. Your token has not been printed.") }
    const code = body.error_code ?? response.status
    if (code === 401 || code === 404) throw new Error("Telegram rejected the bot token. Copy the complete API token from @BotFather into the root .env.")
    if (code === 409) throw new Error("Another application is receiving updates for this bot. Stop its polling process, or use a dedicated bot for Tracer.")
    if (code === 429) throw new Error("Telegram is rate limiting requests. Wait a minute, then try again.")
    if (!response.ok || !body.ok || body.result === undefined) throw new Error("Telegram could not complete chat discovery. Try again shortly.")
    return body.result
  }

  const bot = await call<{ username?: string; is_bot?: boolean }>("getMe")
  if (!bot.is_bot || !bot.username || !/^[a-zA-Z0-9_]{5,32}$/.test(bot.username)) throw new Error("Telegram did not return a valid bot account.")
  announce(`Your bot: https://t.me/${bot.username}`)
  const webhook = await call<{ url?: string }>("getWebhookInfo")
  if (webhook.url) throw new Error("This bot has a webhook managed by another application, which prevents chat discovery here. Use a dedicated bot or disable the webhook in that application. No webhook was changed.")
  announce("Open that bot in Telegram (not BotFather), then send /start. Waiting up to 20 seconds…")
  const updates = await call<Update[]>("getUpdates", "?timeout=20")
  if (!Array.isArray(updates)) throw new Error("Telegram returned an unexpected response. Try again.")
  const chats = new Map<number, TelegramChat>()
  for (const update of updates) {
    const chat = update.message?.chat ?? update.channel_post?.chat ?? update.my_chat_member?.chat
    if (chat && Number.isSafeInteger(chat.id)) chats.set(chat.id, chat)
  }
  return [...chats.values()]
}
