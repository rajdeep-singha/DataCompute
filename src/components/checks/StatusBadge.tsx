import type { StatusBadgeProps } from "../../types/ui"

const TONE: Record<string, string> = {
  pass: "bg-pass/15 text-pass",
  mismatch: "bg-mismatch/15 text-mismatch",
  fail: "bg-fail/15 text-fail",
  absent: "bg-absent/15 text-absent",
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 font-mono text-xs ${TONE[status] ?? "text-zinc-300"}`}>
      {status}
    </span>
  )
}
