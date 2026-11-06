import type { Address } from "viem"
import type { Severity } from "../../types/alert"
import type { ChainResult } from "../../types/diamond"
import { diamondChain } from "../../config"
import { dashboardLink, fingerprint, recordNotification } from "./telegram"

export function notifyProxy(args: { proxy: Address; name: string; oldImpl: Address; newImpl: Address; block: bigint; verified: string; severity: Severity; baseline?: boolean; simulated?: boolean }, record = recordNotification) {
  record((queue) => {
    const headline = args.simulated
      ? "🧪 SIMULATION — Proxy upgrade"
      : args.severity === "critical" && args.verified === "unverified"
        ? `⚠ ${args.name} upgraded to UNVERIFIED code`
        : args.severity === "critical"
          ? `⚠ ${args.name} implementation changed`
          : "DataVerify — Proxy upgrade"
    const text = [
      headline,
      `Observed at: ${new Date().toISOString()}`,
      `${args.name} · Ethereum · ${args.severity.toUpperCase()}`,
      `Contract: ${args.proxy}`, `Previous implementation: ${args.oldImpl}`, `New implementation: ${args.newImpl}`,
      `Sourcify: ${args.verified}`, `Observed block: ${args.block}`,
      "Verification status is a risk signal, not proof of safety or an attack.",
      `Contract: https://etherscan.io/address/${args.proxy}`, dashboardLink("/alerts"),
      "Detection notice; audit evidence may still be pending.",
    ].filter(Boolean).join("\n")
    if (args.simulated) queue.enqueue(text)
    else queue.observe(`proxy:1:${args.proxy.toLowerCase()}`, args.newImpl.toLowerCase(), args.baseline ? undefined : text)
  })
}

export function notifyDiamond(diamond: string, address: Address, result: ChainResult, simulated: boolean, record = recordNotification) {
  record((queue) => {
    const scope = `diamond:${result.chainId}:${address.toLowerCase()}`
    const label = `${diamond} · ${result.chain} (${result.chainId})`
    const links = [`Contract: ${diamondChain(result.chainId)?.explorer}/address/${address}`, dashboardLink("/diamond")].filter(Boolean).join("\n")
    if (result.verdict === "unreachable" || result.verdict === "unpinned") {
      // Failed simulations must not overwrite live monitoring health.
      if (!simulated) queue.observe(`${scope}:health`, result.verdict, `DataVerify — Monitoring warning\n${label}\n${result.detail}\n${links}`)
      return
    }
    const findings = result.findings.map((finding) => ({ ...finding, selectors: [...finding.selectors].sort(), signatures: undefined }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    const text = [
      simulated ? "🧪 SIMULATION — Diamond finding" : "DataVerify — Diamond finding",
      `Observed at: ${new Date().toISOString()}`,
      `${label} · ${result.severity.toUpperCase()}`, result.detail,
      ...result.findings.slice(0, 8).map((f) => `${f.kind}: ${(f.signatures ?? f.selectors).slice(0, 4).join(", ")}${f.actual ? ` → ${f.actual}` : ""}${f.verified ? ` (${f.verified})` : ""}`),
      "Findings indicate risk; they do not establish that an attack occurred.", links,
      "Detection notice; audit evidence may still be pending.",
    ].join("\n")
    if (simulated) { queue.enqueue(text); return }
    queue.observe(`${scope}:health`, null, undefined, `DataVerify — Monitoring restored\n${label}\n${links}`)
    queue.observe(`${scope}:risk`, findings.length ? fingerprint(findings) : null, text,
      `DataVerify — Findings cleared\n${label}\nMatches the pinned manifest again. This is not a security audit.\n${links}`)
  })
}
