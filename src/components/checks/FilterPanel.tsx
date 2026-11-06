import { CHECK_KINDS, STATUSES } from "../../types/check"
import type { FilterPanelProps } from "../../types/ui"

export function FilterPanel({ filters, counts, loading, onChange, onSubmit }: FilterPanelProps) {
  return (
    <form
      className="grid gap-3 rounded-2xl border border-line bg-panel p-3 shadow-2xl sm:grid-cols-2 sm:p-4 lg:sticky lg:top-4 lg:grid-cols-1"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label className="grid gap-1.5 text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
        Status
        <select
          className="rounded-lg border border-line bg-ink px-3 py-2 text-sm tracking-normal text-zinc-100 normal-case"
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value as FilterPanelProps["filters"]["status"] })}
        >
          <option value="">Any</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
        Check
        <select
          className="rounded-lg border border-line bg-ink px-3 py-2 text-sm tracking-normal text-zinc-100 normal-case"
          value={filters.check}
          onChange={(event) => onChange({ ...filters, check: event.target.value as FilterPanelProps["filters"]["check"] })}
        >
          <option value="">Any</option>
          {CHECK_KINDS.map((check) => (
            <option key={check} value={check}>
              {check}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
        Symbol
        <input
          className="rounded-lg border border-line bg-ink px-3 py-2 font-mono text-sm tracking-normal text-zinc-100 normal-case"
          value={filters.symbol}
          placeholder="USDC"
          onChange={(event) => onChange({ ...filters, symbol: event.target.value })}
        />
      </label>

      <label className="grid gap-1.5 text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
        Address
        <input
          className="rounded-lg border border-line bg-ink px-3 py-2 font-mono text-sm tracking-normal text-zinc-100 normal-case"
          value={filters.subject}
          placeholder="0x…"
          onChange={(event) => onChange({ ...filters, subject: event.target.value })}
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
          onClick={() =>
            onChange({ status: "", check: "", symbol: "", subject: "" })
          }
        >
          Clear
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
        {STATUSES.map((status) => (
          <div key={status} className="rounded-xl border border-line px-3 py-2">
            <b className="block font-mono text-lg font-medium">{counts[status]}</b>
            <span className="text-[11px] text-zinc-500">{status}</span>
          </div>
        ))}
      </div>
    </form>
  )
}
