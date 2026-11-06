export function shortAddress(value: string): string {
  if (value.length < 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

/** Rabdi blocks are 2 seconds. `head` is the Arkiv block the query was read at. */
export function expiryLabel(expiresAt: bigint, head: bigint | null): string {
  if (head === null) return `block ${expiresAt}`
  const left = expiresAt - head
  if (left <= 0n) return "expired"
  const hours = Number((left * 2n) / 3600n)
  if (hours >= 48) return `${Math.floor(hours / 24)}d left`
  if (hours >= 1) return `${hours}h left`
  return "<1h left"
}
