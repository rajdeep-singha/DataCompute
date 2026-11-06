import type { AlertRow } from "../../types/alert"
import { shortAddress } from "../util/format"

/**
 * System notifications for malicious upgrades, via the Web Notifications API.
 * This fires a real OS-level notification (macOS Notification Center, Windows
 * toast, etc.) while the page is open. Permission is per-origin and must be
 * granted by the user from a click — browsers reject silent requests.
 */

export type NotifyPermission = "default" | "granted" | "denied" | "unsupported"

export function notifyPermission(): NotifyPermission {
  if (typeof Notification === "undefined") return "unsupported"
  return Notification.permission
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (typeof Notification === "undefined") return "unsupported"
  if (Notification.permission === "granted") return "granted"
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/** The critical rows whose keys aren't in `seen` — i.e. newly-appeared malicious upgrades. */
export function pickNewAlerts(rows: AlertRow[], seen: ReadonlySet<string>): AlertRow[] {
  return rows.filter((row) => row.severity === "critical" && !seen.has(row.key))
}

/** Human-readable title/body for a malicious-upgrade alert. */
export function maliciousMessage(alert: AlertRow): { title: string; body: string } {
  const unverified = alert.verified === "unverified"
  return {
    title: unverified
      ? `⚠ ${alert.proxyName} upgraded to UNVERIFIED code`
      : `⚠ ${alert.proxyName} implementation changed`,
    body: unverified
      ? `New implementation ${shortAddress(alert.newImpl)} is not verified on Sourcify. Review before interacting with this contract.`
      : alert.detail,
  }
}

/** Fires one system notification for a malicious upgrade. Returns false if it couldn't. */
export function notifyMalicious(alert: AlertRow): boolean {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false
  const { title, body } = maliciousMessage(alert)
  try {
    const notification = new Notification(title, {
      body,
      // `tag` dedupes repeat notifications for the same alert key across reloads.
      tag: `dataverify-${alert.key}`,
      requireInteraction: alert.verified === "unverified",
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return true
  } catch {
    return false
  }
}
