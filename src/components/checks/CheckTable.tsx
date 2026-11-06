import { expiryLabel, shortAddress } from "../../lib/util/format"
import type { CheckTableProps } from "../../types/ui"
import { StatusBadge } from "./StatusBadge"

export function CheckTable({ rows, headBlock, loading, error }: CheckTableProps) {
  if (error) {
    return <p className="px-5 py-10 text-fail">{error}</p>
  }
  if (loading && rows.length === 0) {
    return <p className="px-5 py-10 text-zinc-400">Reading checks from Arkiv…</p>
  }
  if (rows.length === 0) {
    return (
      <p className="px-5 py-10 leading-relaxed text-zinc-400">
        No checks matched. Run <span className="font-mono text-zinc-200">npm run verify</span> after
        funding the writer wallet, then set <span className="font-mono text-zinc-200">VITE_VERIFIER_ADDRESS</span>.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[11px] tracking-[0.12em] text-zinc-500 uppercase">
            <th className="px-4 py-3 font-medium">Symbol</th>
            <th className="px-4 py-3 font-medium">Check</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Address</th>
            <th className="px-4 py-3 font-medium">Detail</th>
            <th className="px-4 py-3 font-medium">Expires</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-line align-top hover:bg-white/5">
              <td className="px-4 py-3 font-mono text-sm">{row.symbol}</td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-300">{row.check}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-400" title={row.subject}>
                {shortAddress(row.subject)}
              </td>
              <td className="max-w-xs px-4 py-3 text-sm leading-snug text-zinc-400">{row.detail}</td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                {expiryLabel(row.expiresAt, headBlock)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
