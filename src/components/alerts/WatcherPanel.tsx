import { useState } from "react"
import { WATCHLIST } from "../../config"
import { shortAddress } from "../../lib/util/format"
import { requestWatch } from "../../lib/alerts/watch-api"
import type { WatchOutcome, WatchRun } from "../../types/alert"

type WatcherPanelProps = {
  /** Called after a pass writes to Arkiv, so the alert list can re-query. */
  onRun: () => void
}

const OUTCOME_TONE: Record<WatchOutcome, string> = {
  unchanged: "text-zinc-400",
  baseline: "text-absent",
  upgraded: "text-mismatch",
  simulated: "text-fail",
  skipped: "text-zinc-500",
}

export function WatcherPanel({ onRun }: WatcherPanelProps) {
  const [target, setTarget] = useState<string>(WATCHLIST[0].name)
  const [busy, setBusy] = useState<"scan" | "simulate" | null>(null)
  const [run, setRun] = useState<WatchRun | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function start(kind: "scan" | "simulate") {
    setBusy(kind)
    setError(null)
    try {
      const result = await requestWatch(kind === "simulate" ? target : undefined)
      setRun(result)
      onRun()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "watcher failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mb-4 grid gap-3 rounded-2xl border border-line bg-panel p-4 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg">Watcher</h2>
          <p className="text-sm text-zinc-400">
            Reads {WATCHLIST.length} proxies on Ethereum now and writes any change to Arkiv.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            disabled={busy !== null}
            onClick={() => void start("scan")}
          >
            {busy === "scan" ? "Scanning…" : "Run watcher now"}
          </button>
          <select
            className="rounded-lg border border-line bg-ink px-3 py-2 text-sm text-zinc-100"
            value={target}
            disabled={busy !== null}
            onChange={(event) => setTarget(event.target.value)}
          >
            {WATCHLIST.map((item) => (
              <option key={item.address} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-lg border border-fail/50 px-3 py-2 text-sm text-fail disabled:opacity-60"
            disabled={busy !== null}
            onClick={() => void start("simulate")}
            title="Writes a clearly labeled fake critical alert for the selected proxy"
          >
            {busy === "simulate" ? "Writing…" : "Simulate upgrade"}
          </button>
        </div>
      </div>

      {busy ? (
        <p className="text-sm text-zinc-400">
          Reading Ethereum, checking Sourcify and writing to Arkiv. This can take up to a minute.
        </p>
      ) : null}
      {error ? <p className="text-sm text-fail">{error}</p> : null}

      {run ? (
        <div className="overflow-x-auto">
          <p className="mb-2 font-mono text-[11px] text-zinc-500">
            block {run.block} · watcher {shortAddress(run.watcher)} · swarm {run.swarm ? "on" : "off"}
          </p>
          <ul className="grid gap-1 font-mono text-xs">
            {run.results.map((result) => (
              <li key={result.proxy} className="flex flex-wrap gap-x-3">
                <span className="w-44 text-zinc-200">{result.name}</span>
                <span className={OUTCOME_TONE[result.outcome]}>{result.outcome}</span>
                {result.implementation ? (
                  <span className="text-zinc-500">{shortAddress(result.implementation)}</span>
                ) : null}
                {result.verified ? <span className="text-zinc-400">{result.verified}</span> : null}
                {result.txHash ? (
                  <a
                    className="text-accent underline-offset-2 hover:underline"
                    href={`https://rabdi.explorer.arkiv.network/tx/${result.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    tx ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
