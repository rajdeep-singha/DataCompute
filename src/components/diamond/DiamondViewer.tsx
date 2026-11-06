import { useEffect, useState } from "react"
import { getAddress } from "viem"
import { DIAMONDS, diamondChain, swarmUrl, ZERO_ADDRESS } from "../../config"
import { arkivTimeoutMessage, browserClient } from "../../lib/arkiv/read-checks"
import { watcherAddress } from "../../lib/arkiv/watcher-address"
import { requestDiamondCheck } from "../../lib/diamond/diamond-api"
import { readDiamondRuns, type DiamondRunRows } from "../../lib/diamond/read-diamond"
import { shortAddress } from "../../lib/util/format"
import type { DiamondCheckRow, DiamondRun, Finding } from "../../types/diamond"

const client = browserClient()

const SEV_TONE: Record<string, string> = {
  critical: "bg-fail/15 text-fail border-fail/40",
  warning: "bg-mismatch/15 text-mismatch border-mismatch/40",
  info: "bg-pass/15 text-pass border-pass/40",
}

const SEV_RAIL: Record<string, string> = {
  critical: "border-l-fail",
  warning: "border-l-mismatch",
  info: "border-l-pass",
}

const SEV_DOT: Record<string, string> = {
  critical: "bg-fail",
  warning: "bg-mismatch",
  info: "bg-pass",
}

const FINDING_LABEL: Record<Finding["kind"], string> = {
  "unexpected-function": "new function",
  "facet-code-changed": "code changed",
  "missing-function": "removed",
  "owner-changed": "owner changed",
}

const FIELD = "rounded-lg border border-line bg-ink px-3 py-2 text-sm text-zinc-100"

function runTime(run: bigint): string {
  return new Date(Number(run)).toLocaleString()
}

function Headline({ rows }: { rows: DiamondCheckRow[] }) {
  const critical = rows.filter((row) => row.severity === "critical")
  const warning = rows.filter((row) => row.severity === "warning")
  if (critical.length > 0) {
    return (
      <div className="rounded-2xl border border-fail/50 bg-fail/10 px-4 py-3">
        <p className="font-serif text-lg text-fail">
          ⚠ Likely malicious on {critical.map((row) => row.chainName).join(", ")}
        </p>
        {critical.map((row) => (
          <p key={row.key} className="text-sm text-zinc-300">
            <b className="text-zinc-100">{row.chainName}:</b> {row.detail}
          </p>
        ))}
      </div>
    )
  }
  if (warning.length > 0) {
    return (
      <div className="rounded-2xl border border-mismatch/50 bg-mismatch/10 px-4 py-3">
        <p className="font-serif text-lg text-mismatch">
          Changed on {warning.map((row) => row.chainName).join(", ")}
        </p>
        <p className="text-sm text-zinc-400">
          The new code is verified on Sourcify or the chain couldn’t be read. Review it, then re-pin the manifest if it’s expected.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-pass/40 bg-pass/10 px-4 py-3">
      <p className="font-serif text-lg text-pass">All {rows.length} chains match the pinned manifest</p>
    </div>
  )
}

const SUMMARY_WORD: Record<Finding["kind"], [string, string]> = {
  "facet-code-changed": ["code change", "code changes"],
  "unexpected-function": ["new function", "new functions"],
  "missing-function": ["removed function", "removed functions"],
  "owner-changed": ["owner change", "owner changes"],
}

/** "11 code changes · 2 new functions · 1 unverified", shown while a card is collapsed. */
function findingSummary(findings: Finding[]): string {
  const counts = new Map<Finding["kind"], number>()
  for (const finding of findings) counts.set(finding.kind, (counts.get(finding.kind) ?? 0) + 1)
  const parts = [...counts].map(([kind, count]) => `${count} ${SUMMARY_WORD[kind][count > 1 ? 1 : 0]}`)
  const unverified = findings.filter((finding) => finding.verified === "unverified").length
  if (unverified > 0) parts.push(`${unverified} unverified`)
  return parts.join(" · ")
}

const PREVIEW = 2

/** The first signatures of a change, with the rest behind one toggle, each on its own line. */
function FunctionLines({ names }: { names: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? names : names.slice(0, PREVIEW)
  return (
    <div className="min-w-0">
      <ul className="grid gap-0.5">
        {shown.map((name, index) => (
          <li key={`${name}-${index}`} className="font-mono text-[11px] break-all text-zinc-300">
            {name}
          </li>
        ))}
      </ul>
      {names.length > PREVIEW ? (
        <button type="button" className="mt-1 font-mono text-[11px] text-accent" onClick={() => setExpanded((open) => !open)}>
          {expanded ? "Show fewer" : `+${names.length - PREVIEW} more`}
        </button>
      ) : null}
    </div>
  )
}

/** The changes on one chain, as a table: what changed, which functions, which facet, and Sourcify's verdict. */
function FindingsTable({ findings }: { findings: Finding[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-ink font-mono text-[10px] tracking-[0.12em] text-zinc-500 uppercase">
            <th className="px-3 py-2 font-medium">Change</th>
            <th className="px-3 py-2 font-medium">Functions</th>
            <th className="px-3 py-2 font-medium">Facet</th>
            <th className="px-3 py-2 font-medium">Sourcify</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((finding, index) => {
            const names =
              finding.kind === "owner-changed"
                ? [`${shortAddress(finding.expected ?? "")} → ${shortAddress(finding.actual ?? "")}`]
                : (finding.signatures ?? finding.selectors)
            return (
              <tr key={index} className="border-t border-line align-top">
                <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-zinc-400">
                  {FINDING_LABEL[finding.kind]}
                </td>
                <td className="max-w-lg px-3 py-2">
                  <FunctionLines names={names} />
                </td>
                <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-zinc-300">
                  {finding.facet ? shortAddress(finding.facet) : "—"}
                </td>
                <td
                  className={`px-3 py-2 font-mono text-[11px] whitespace-nowrap ${
                    finding.verified === "unverified" ? "text-fail" : finding.verified ? "text-pass" : "text-zinc-500"
                  }`}
                >
                  {finding.verified ?? "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function DiamondViewer() {
  const owner = watcherAddress()
  const [diamondId, setDiamondId] = useState<string>(DIAMONDS[0].id)
  const diamond = DIAMONDS.find((item) => item.id === diamondId) ?? DIAMONDS[0]
  const [target, setTarget] = useState<number>(diamond.chainIds[diamond.chainIds.length - 1]!)
  const [runs, setRuns] = useState<DiamondRunRows[]>([])
  const [lastRun, setLastRun] = useState<DiamondRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<"check" | "simulate" | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Chains the user has expanded. A fresh run opens only the chains flagged as malicious.
  const [openChains, setOpenChains] = useState<Set<number>>(new Set())

  async function load() {
    setLoading(true)
    try {
      const page = await readDiamondRuns(client, diamondId, owner)
      setRuns(page.runs)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Arkiv query failed"
      setError(arkivTimeoutMessage(message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [diamondId])

  async function start(kind: "check" | "simulate") {
    setBusy(kind)
    setError(null)
    try {
      const result = await requestDiamondCheck(diamondId, kind === "simulate" ? target : undefined)
      setLastRun(result)
      setOpenChains(new Set(result.results.filter((item) => item.severity === "critical").map((item) => item.chainId)))
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "diamond check failed")
    } finally {
      setBusy(null)
    }
  }

  const chainOrder = (row: DiamondCheckRow) => (diamond.chainIds as readonly number[]).indexOf(Number(row.chainId))
  const ordered = runs.map((item) => ({ ...item, rows: [...item.rows].sort((a, b) => chainOrder(a) - chainOrder(b)) }))
  const latest = ordered[0]
  const findingsFor = (row: DiamondCheckRow) =>
    lastRun && BigInt(lastRun.run) === row.run
      ? (lastRun.results.find((result) => BigInt(result.chainId) === row.chainId)?.findings ?? [])
      : []

  return (
    <>
      <p className="mb-5 max-w-2xl text-zinc-400">
        Each chain of a diamond is compared with a reviewed manifest. A new or changed facet with{" "}
        <span className="text-fail">unverified code</span>, or a new owner, marks that chain as likely malicious.
      </p>

      <section className="mb-4 grid gap-3 rounded-2xl border border-line bg-panel p-4 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={FIELD}
              value={diamondId}
              disabled={busy !== null}
              onChange={(event) => setDiamondId(event.target.value)}
            >
              {DIAMONDS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="font-mono text-xs text-zinc-500">{diamond.address}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => void start("check")}
            >
              {busy === "check" ? "Checking…" : "Check all chains"}
            </button>
            <select
              className={FIELD}
              value={target}
              disabled={busy !== null}
              onChange={(event) => setTarget(Number(event.target.value))}
            >
              {diamond.chainIds.map((chainId) => (
                <option key={chainId} value={chainId}>
                  {diamondChain(chainId)?.name ?? chainId}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-lg border border-fail/50 px-3 py-2 text-sm text-fail disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => void start("simulate")}
              title="Plants a fake unverified facet on the selected chain for this run only; real chains and the manifest are untouched"
            >
              {busy === "simulate" ? "Checking…" : "Simulate attack"}
            </button>
          </div>
        </div>
        {busy ? (
          <p className="text-sm text-zinc-400">
            Reading the diamond on {diamond.chainIds.length} chains, checking Sourcify and writing to Arkiv. About 15 seconds.
          </p>
        ) : null}
        {error ? <p className="text-sm text-fail">{error}</p> : null}
        {owner === getAddress(ZERO_ADDRESS) ? (
          <p className="text-sm text-mismatch">Set VITE_WATCHER_ADDRESS so the page keeps only your watcher wallet’s results.</p>
        ) : null}
      </section>

      {loading && !latest ? (
        <p className="px-1 py-6 text-zinc-400">Querying Arkiv…</p>
      ) : !latest ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-zinc-400">
          No checks yet. Click <span className="text-zinc-200">Check all chains</span> to write the first one.
        </p>
      ) : (
        <div className="grid gap-4">
          <Headline rows={latest.rows} />

          <div className="flex items-baseline justify-between gap-3 px-1">
            <p className="text-sm text-zinc-400">Latest run · {runTime(latest.run)}</p>
            {latest.rows[0]?.evidence ? (
              <a
                href={swarmUrl(latest.rows[0].evidence)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-accent underline-offset-2 hover:underline"
              >
                full findings on Swarm ↗
              </a>
            ) : null}
          </div>

          <ul className="grid items-start gap-3 md:grid-cols-2">
            {latest.rows.map((row) => {
              const chain = diamondChain(Number(row.chainId))
              const findings = findingsFor(row)
              const chainId = Number(row.chainId)
              const open = openChains.has(chainId)
              const changeCount = findings.length || Number(row.findings)
              return (
                <li
                  key={row.key}
                  className={`grid min-w-0 gap-2 rounded-2xl border border-l-4 border-line bg-panel p-4 ${SEV_RAIL[row.severity] ?? "border-l-line"} ${open ? "md:col-span-2" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif text-lg">{row.chainName}</span>
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-xs ${SEV_TONE[row.severity] ?? ""}`}>
                      {row.verdict}
                    </span>
                  </div>
                  <p className="text-sm break-words text-zinc-300">
                    {findings.length > 0 ? findingSummary(findings) : row.detail}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    {chain ? (
                      <a
                        href={`${chain.explorer}/address/${row.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                      >
                        {shortAddress(row.address)} ↗
                      </a>
                    ) : (
                      <span />
                    )}
                    {findings.length > 0 ? (
                      <button
                        type="button"
                        className="font-mono text-[11px] text-accent"
                        onClick={() =>
                          setOpenChains((current) => {
                            const next = new Set(current)
                            if (next.has(chainId)) next.delete(chainId)
                            else next.add(chainId)
                            return next
                          })
                        }
                      >
                        {open ? "Hide" : "Show"} {changeCount} {changeCount === 1 ? "change" : "changes"}
                      </button>
                    ) : null}
                  </div>
                  {open && findings.length > 0 ? <FindingsTable findings={findings} /> : null}
                </li>
              )
            })}
          </ul>

          {ordered.length > 1 ? (
            <section className="rounded-2xl border border-line bg-panel p-4">
              <h3 className="mb-2 text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Earlier runs</h3>
              <ul className="grid gap-1.5">
                {ordered.slice(1, 12).map((item) => (
                  <li key={String(item.run)} className="flex flex-wrap items-center gap-3 font-mono text-xs text-zinc-400">
                    <span className="w-44">{runTime(item.run)}</span>
                    {item.rows.map((row) => (
                      <span key={row.key} className="inline-flex items-center gap-1" title={row.detail}>
                        <span className={`size-2 rounded-full ${SEV_DOT[row.severity] ?? "bg-zinc-600"}`} />
                        {row.chainName}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </>
  )
}
