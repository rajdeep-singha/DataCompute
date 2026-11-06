import type { CheckFilters } from "../../types/check"
import { SCHEMA_NAME, ZERO_ADDRESS } from "../../config"

function quote(value: string): string {
  return value.replaceAll("'", "''")
}

/** The query string a judge can paste into `arkiv_query`. */
export function describeQuery(filters: CheckFilters, owner: string): string {
  const parts = [`arkiv.schema = str('${SCHEMA_NAME}')`]
  if (owner && owner.toLowerCase() !== ZERO_ADDRESS) {
    parts.push(`$owner = addr(${owner})`)
  }
  if (filters.check) parts.push(`check = str('${quote(filters.check)}')`)
  if (filters.status) parts.push(`status = str('${quote(filters.status)}')`)
  if (filters.symbol.trim()) parts.push(`symbol = str('${quote(filters.symbol.trim())}')`)
  if (filters.subject.trim()) parts.push(`subject = addr(${filters.subject.trim()})`)
  return parts.join("\n  AND ")
}
