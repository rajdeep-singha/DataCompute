import type { CheckFilters, CheckRow, CheckStatus } from "./check"

export type FilterPanelProps = {
  filters: CheckFilters
  counts: Record<CheckStatus, number>
  loading: boolean
  onChange: (filters: CheckFilters) => void
  onSubmit: () => void
}

export type CheckTableProps = {
  rows: CheckRow[]
  headBlock: bigint | null
  loading: boolean
  error: string | null
}

export type StatusBadgeProps = {
  status: string
}

export type QueryPreviewProps = {
  query: string
}
