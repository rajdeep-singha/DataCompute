import { useCallback, useEffect, useRef, useState } from "react"
import { getAddress, isAddress } from "viem"
import { ZERO_ADDRESS } from "../config"
import { browserClient } from "../lib/arkiv/read-checks"
import { readAlerts } from "../lib/alerts/read-alerts"
import {
  notifyMalicious,
  notifyPermission,
  pickNewAlerts,
  requestNotifyPermission,
  type NotifyPermission,
} from "../lib/alerts/notify"
import type { AlertRow } from "../types/alert"

const client = browserClient()
const SEEN_KEY = "dataverify.seen-critical"
const POLL_MS = 12_000

function watcherOwner(): string {
  const raw = import.meta.env.VITE_WATCHER_ADDRESS ?? import.meta.env.VITE_VERIFIER_ADDRESS ?? ""
  return isAddress(raw) ? getAddress(raw) : ZERO_ADDRESS
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)))
  } catch {
    // storage full or unavailable — non-fatal, we just re-notify next session.
  }
}

/**
 * Polls Arkiv for critical (malicious) upgrade alerts and fires a system
 * notification when a new one appears. Existing alerts at first load are marked
 * seen silently, so only genuinely new upgrades notify. Enabled by the user from
 * a click (browser permission); otherwise it just tracks, never notifying.
 */
export function useCriticalAlertNotifier() {
  const owner = watcherOwner()
  const [permission, setPermission] = useState<NotifyPermission>(notifyPermission())
  const [enabled, setEnabled] = useState(false)
  const [lastAlert, setLastAlert] = useState<AlertRow | null>(null)
  const seenRef = useRef<Set<string>>(loadSeen())
  const primedRef = useRef(false)

  const enable = useCallback(async () => {
    const next = await requestNotifyPermission()
    setPermission(next)
    // Monitor regardless: if the OS permission is denied, the in-app toast still works.
    setEnabled(true)
    return next
  }, [])

  const disable = useCallback(() => setEnabled(false), [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function poll() {
      try {
        const page = await readAlerts(client, { severity: "critical", verified: "", proxy: "" }, owner)
        if (cancelled) return
        const seen = seenRef.current
        const fresh = pickNewAlerts(page.rows, seen)

        if (!primedRef.current) {
          // First poll after enabling: adopt the current state without notifying.
          for (const row of page.rows) seen.add(row.key)
          primedRef.current = true
          saveSeen(seen)
          return
        }

        for (const alert of fresh) {
          notifyMalicious(alert)
          seen.add(alert.key)
          setLastAlert(alert)
        }
        if (fresh.length > 0) saveSeen(seen)
      } catch {
        // Transient Arkiv/RPC error — try again on the next tick.
      }
    }

    void poll()
    const timer = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [enabled, owner])

  return { permission, enabled, enable, disable, lastAlert }
}
