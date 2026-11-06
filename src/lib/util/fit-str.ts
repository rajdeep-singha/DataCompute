const STR_MAX_BYTES = 120

/** Arkiv `str` attributes hold at most 128 UTF-8 bytes. */
export function fitStr(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim()
  const bytes = new TextEncoder().encode(trimmed)
  if (bytes.length <= STR_MAX_BYTES) return trimmed
  let end = STR_MAX_BYTES
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end -= 1
  return new TextDecoder().decode(bytes.slice(0, end))
}
