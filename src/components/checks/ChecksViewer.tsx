import { useEffect, useMemo, useState } from "react"
import { getAddress, isAddress } from "viem"
import { ZERO_ADDRESS } from "../../config"
import { describeQuery } from "../../lib/checks/query-text"
import { browserClient, readChecks } from "../../lib/arkiv/read-checks"
import { EMPTY_FILTERS, STATUSES, type CheckFilters, type CheckRow, type CheckStatus } from "../../types/check"
import { CheckTable } from "./CheckTable"
import { FilterPanel } from "./FilterPanel"
import { QueryPreview } from "./QueryPreview"

const client = browserClient()

function verifierAddress(): string {
  const raw = import.meta.env.VITE_VERIFIER_ADDRESS ?? ""
  return isAddress(raw) ? getAddress(raw) : ZERO_ADDRESS
}

function emptyCounts(): Record<CheckStatus, number> {
  return { pass: 0, mismatch: 0, fail: 0, absent: 0 }
}

export function ChecksViewer() {
  const owner = verifierAddress()
  const [filters, setFilters] = useState<CheckFilters>(EMPTY_FILTERS)
  const [rows, setRows] = useState<CheckRow[]>([])
  const [headBlock, setHeadBlock] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo(() => describeQuery(filters, owner), [filters, owner])
  const counts = useMemo(() => {
    const next = emptyCounts()
    for (const row of rows) {
      if ((STATUSES as readonly string[]).includes(row.status)) {
        next[row.status as CheckStatus] += 1
      }
    }
    return next
  }, [rows])

  async function load(next: CheckFilters) {
    setLoading(true)
    setError(null)
    try {
      const page = await readChecks(client, next, owner)
      setRows(page.rows)
      setHeadBlock(page.blockNumber)
    } catch (caught) {
      setRows([])
      const message = caught instanceof Error ? caught.message : "Arkiv query failed"
      const lower = message.toLowerCase()
      setError(
        lower.includes("timeout") || lower.includes("fetch") || lower.includes("too long")
          ? "Arkiv didn’t respond. The public Rabdi RPC may be rate limited. Add VITE_ARKIV_ACCESS_KEY and try again."
          : message,
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(EMPTY_FILTERS)
  }, [])

  return (
    <>
      <p className="mb-5 max-w-md text-zinc-400">
        Ethereum token checks, stored as expiring Arkiv entities. This page only shows what Arkiv returns.
      </p>

      {owner === getAddress(ZERO_ADDRESS) ? (
        <p className="mb-4 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-mismatch">
          Set VITE_VERIFIER_ADDRESS so the page keeps only your verifier wallet’s checks.
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
        <FilterPanel
          filters={filters}
          counts={counts}
          loading={loading}
          onChange={setFilters}
          onSubmit={() => void load(filters)}
        />
        <section className="min-h-[420px] overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
          <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-4">
            <p className="text-zinc-400">{loading ? "Querying Arkiv" : `${rows.length} checks`}</p>
            <p className="font-mono text-xs text-zinc-500">
              {owner === getAddress(ZERO_ADDRESS) ? "any owner" : owner}
            </p>
          </header>
          <CheckTable rows={rows} headBlock={headBlock} loading={loading} error={error} />
        </section>
      </div>
      <QueryPreview query={query} />
    </>
  )
}
