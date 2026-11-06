import type { AlertRow } from "../../types/alert"

/** Asks the server to send the same critical upgrade to Telegram. Deduped there. */
export function notifyTelegramAlert(alert: AlertRow) {
  void fetch("/api/telegram/alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proxy: alert.proxy,
      name: alert.proxyName,
      oldImpl: alert.oldImpl,
      newImpl: alert.newImpl,
      verified: alert.verified,
      severity: alert.severity,
      block: alert.block.toString(),
      detail: alert.detail,
    }),
  }).catch(() => {
    // The browser notification still stands if Telegram is down.
  })
}
