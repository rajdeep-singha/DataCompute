const OPENCHAIN_LOOKUP = "https://api.openchain.xyz/signature-database/v1/lookup"

type LookupResponse = {
  result?: { function?: Record<string, Array<{ name: string }> | null> }
}

/** Best-effort names for 4-byte selectors. Unknown or unreachable selectors are simply absent. */
export async function lookupSignatures(selectors: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const unique = [...new Set(selectors.map((s) => s.toLowerCase()))].slice(0, 50)
  if (unique.length === 0) return names
  try {
    const res = await fetch(`${OPENCHAIN_LOOKUP}?function=${unique.join(",")}&filter=true`, {
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return names
    const body = (await res.json()) as LookupResponse
    for (const [selector, matches] of Object.entries(body.result?.function ?? {})) {
      const name = matches?.[0]?.name
      if (name) names.set(selector.toLowerCase(), name)
    }
  } catch {
    // Names are cosmetic; the raw selector is still shown.
  }
  return names
}
