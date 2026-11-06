import { useEffect, useMemo, useState } from "react"
import { getAddress } from "viem"
import { swarmUrl, ZERO_ADDRESS } from "../../config"
import { expiryLabel, shortAddress } from "../../lib/util/format"
import { arkivTimeoutMessage, browserClient } from "../../lib/arkiv/read-checks"
import { watcherAddress } from "../../lib/arkiv/watcher-address"
import { readAlerts } from "../../lib/alerts/read-alerts"
import {
  EMPTY_ALERT_FILTERS,
  SEVERITIES,
  VERIFIED_STATES,
  type AlertFilters,
  type AlertRow,
  type Severity,
  type VerifiedState,
} from "../../types/alert"
import { WatcherPanel } from "./WatcherPanel"

const client = browserClient()

const SEV_TONE: Record<string, string> = {
  critical: "bg-fail/15 text-fail border-fail/40",
  warning: "bg-mismatch/15 text-mismatch border-mismatch/40",
  info: "bg-absent/15 text-absent border-absent/40",
}

const SEV_RAIL: Record<string, string> = {
  critical: "border-l-fail",
  warning: "border-l-mismatch",
  info: "border-l-absent",
}

const VERIFIED_TONE: Record<string, string> = {
  exact_match: "text-pass",
  match: "text-pass",
  unverified: "text-fail",
  unknown: "text-zinc-400",
}

const FIELD =
  "rounded-lg border border-line bg-ink px-3 py-2 text-sm tracking-normal text-zinc-100 normal-case"
const LABEL = "grid gap-1.5 text-[11px] tracking-[0.14em] text-zinc-500 uppercase"

export function AlertsViewer() {
  const owner = watcherAddress()
  const [filters, setFilters] = useState<AlertFilters>(EMPTY_ALERT_FILTERS)
  const [rows, setRows] = useState<AlertRow[]>([])
  const [headBlock, setHeadBlock] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const counts = useMemo(() => {
    const next = { critical: 0, warning: 0, info: 0 } as Record<Severity, number>
    for (const row of rows) {
      if (row.severity in next) next[row.severity as Severity] += 1
    }
    return next
  }, [rows])

  async function load(next: AlertFilters) {
    setLoading(true)
    setError(null)
    try {
      const page = await readAlerts(client, next, owner)
      setRows(page.rows)
      setHeadBlock(page.blockNumber)
    } catch (caught) {
      setRows([])
      const message = caught instanceof Error ? caught.message : "Arkiv query failed"
      setError(arkivTimeoutMessage(message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(EMPTY_ALERT_FILTERS)
  }, [])

  return (
    <>
      <p className="mb-5 max-w-xl text-zinc-400">
        Proxy upgrade alerts. The watcher reads each proxy’s EIP-1967 implementation slot, and when it
        changes, asks Sourcify whether the new code is verified — a swap to{" "}
        <span className="text-fail">unverified code</span> is the red flag. Every alert is an Arkiv
        entity owned by the watcher wallet, expiring in ~30 days.
      </p>

      {owner === getAddress(ZERO_ADDRESS) ? (
        <p className="mb-4 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-mismatch">
          Set VITE_WATCHER_ADDRESS so the page keeps only your watcher wallet’s alerts.
        </p>
      ) : null}

      <WatcherPanel onRun={() => void load(filters)} />

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[280px_1fr]">
        <form
          className="grid gap-3 rounded-2xl border border-line bg-panel p-3 shadow-2xl sm:p-4 sm:grid-cols-2 lg:sticky lg:top-4 lg:grid-cols-1"
          onSubmit={(event) => {
            event.preventDefault()
            void load(filters)
          }}
        >
          <label className={LABEL}>
            Severity
            <select
              className={FIELD}
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value as Severity | "" })}
            >
              <option value="">Any</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className={LABEL}>
            Verified
            <select
              className={FIELD}
              value={filters.verified}
              onChange={(e) => setFilters({ ...filters, verified: e.target.value as VerifiedState | "" })}
            >
              <option value="">Any</option>
              {VERIFIED_STATES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className={`${LABEL} sm:col-span-2 lg:col-span-1`}>
            Proxy address
            <input
              className={`${FIELD} font-mono`}
              value={filters.proxy}
              placeholder="0x…"
              onChange={(e) => setFilters({ ...filters, proxy: e.target.value })}
            />
          </label>

          <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
            <button
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? "Reading…" : "Query Arkiv"}
            </button>
            <button
              className="rounded-lg border border-line px-3 py-2 text-sm"
              type="button"
              onClick={() => setFilters(EMPTY_ALERT_FILTERS)}
            >
              Clear
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:col-span-2 lg:col-span-1">
            {SEVERITIES.map((s) => (
              <div key={s} className="rounded-xl border border-line px-2.5 py-2.5 text-center">
                <b className="block font-mono text-lg font-medium">{counts[s]}</b>
                <span className="text-[11px] text-zinc-500">{s}</span>
              </div>
            ))}
          </div>
        </form>

        <section className="min-h-[320px] min-w-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl sm:min-h-[420px]">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-3 sm:px-4 sm:py-4">
            <p className="text-zinc-400">{loading ? "Querying Arkiv" : `${rows.length} alerts`}</p>
            <p className="font-mono text-xs text-zinc-500">
              {owner === getAddress(ZERO_ADDRESS) ? "any watcher" : shortAddress(owner)}
            </p>
          </header>

          {error ? (
            <p className="px-4 py-6 text-sm break-words text-fail">{error}</p>
          ) : rows.length === 0 && !loading ? (
            <p className="px-4 py-10 text-center text-zinc-400">
              No alerts yet. Click <span className="text-zinc-200">Run watcher now</span> above to write the first ones.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((row) => (
                <li
                  key={row.key}
                  className={`grid gap-2 border-l-2 px-3 py-3 sm:px-4 sm:py-4 ${SEV_RAIL[row.severity] ?? "border-l-line"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-xs ${SEV_TONE[row.severity] ?? "text-zinc-300"}`}
                      >
                        {row.severity}
                      </span>
                      <span className="font-serif text-base sm:text-lg">{row.proxyName}</span>
                      <a
                        href={`https://etherscan.io/address/${row.proxy}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                      >
                        {shortAddress(row.proxy)}
                      </a>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-500">
                      block {String(row.block)} · {expiryLabel(row.expiresAt, headBlock)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-400">
                    <span>{shortAddress(row.oldImpl)}</span>
                    <span className="text-zinc-600">→</span>
                    <a
                      href={`https://etherscan.io/address/${row.newImpl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-200 underline-offset-2 hover:underline"
                    >
                      {shortAddress(row.newImpl)}
                    </a>
                    <span
                      className={`ml-1 rounded border px-2.5 py-1 ${
                        row.verified === "unverified" ? "border-fail/40 text-fail" : "border-line " + (VERIFIED_TONE[row.verified] ?? "text-zinc-400")
                      }`}
                    >
                      {row.verified}
                    </span>
                    {row.evidence ? (
                      <a
                        href={swarmUrl(row.evidence)}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 rounded border border-accent/40 px-2.5 py-1 text-accent underline-offset-2 hover:underline"
                        title="Evidence bundle on Swarm: bytecode + Sourcify metadata"
                      >
                        evidence ↗
                      </a>
                    ) : null}
                  </div>
                  <p className="text-sm text-zinc-400">{row.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
