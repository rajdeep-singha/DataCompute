import { useEffect, useState } from "react"
import { useCriticalAlertNotifier } from "../../hooks/useCriticalAlertNotifier"
import { shortAddress } from "../../lib/util/format"
import { maliciousMessage } from "../../lib/alerts/notify"
import type { AlertRow } from "../../types/alert"

/**
 * Header control that turns on monitoring for malicious upgrades. Once enabled it
 * polls Arkiv in the background and, when a new critical (unverified) upgrade
 * alert appears, fires an OS notification (if permitted) and shows an in-app
 * toast (always) so the signal is never missed.
 */
export function NotifyBell() {
  const { permission, enabled, enable, disable, lastAlert } = useCriticalAlertNotifier()
  const [toast, setToast] = useState<AlertRow | null>(null)

  useEffect(() => {
    if (!lastAlert) return
    setToast(lastAlert)
    const timer = setTimeout(() => setToast(null), 12_000)
    return () => clearTimeout(timer)
  }, [lastAlert])

  return (
    <>
      {permission === "unsupported" ? null : !enabled ? (
        <button
          type="button"
          onClick={() => void enable()}
          className="rounded-full border border-accent/50 px-3 py-1.5 text-sm text-accent transition hover:bg-accent hover:text-ink"
          title="Get a system notification when a watched contract upgrades to unverified code"
        >
          🔔 Enable alerts
        </button>
      ) : (
        <button
          type="button"
          onClick={disable}
          className="flex items-center gap-2 rounded-full border border-pass/40 px-3 py-1.5 text-sm text-pass transition hover:border-fail/50 hover:text-fail"
          title={
            permission === "granted"
              ? "Watching for malicious upgrades (system + in-app). Click to turn off."
              : "Watching for malicious upgrades (in-app only — OS notifications blocked). Click to turn off."
          }
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pass opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-pass" />
          </span>
          Monitoring
        </button>
      )}

      {toast ? <MaliciousToast alert={toast} onClose={() => setToast(null)} /> : null}
    </>
  )
}

function MaliciousToast({ alert, onClose }: { alert: AlertRow; onClose: () => void }) {
  const { title, body } = maliciousMessage(alert)
  return (
    <div className="fixed right-4 bottom-4 z-50 w-[min(92vw,380px)] animate-[fadeIn_0.2s_ease-out]">
      <div className="overflow-hidden rounded-2xl border border-fail/50 bg-panel shadow-2xl">
        <div className="h-1 w-full bg-fail" />
        <div className="grid gap-1.5 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-fail">{title}</p>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 transition hover:text-zinc-200"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-zinc-400">{body}</p>
          <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-zinc-500">
            <span>{alert.proxyName}</span>
            <a
              href={`https://etherscan.io/address/${alert.newImpl}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline-offset-2 hover:underline"
            >
              {shortAddress(alert.newImpl)} ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
