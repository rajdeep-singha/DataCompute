import { ExpirationTime } from "@arkiv-network/sdk"
import { addr, u64 } from "@arkiv-network/sdk/schema"
import { getAddress, keccak256, toFunctionSelector, toHex, type Address } from "viem"
import { DIAMOND_CHECK_LIFETIME_DAYS, DIAMONDS, diamondChain } from "../../config"
import { DiamondChecks } from "../../schema"
import type { ChainResult, DiamondRun, DiamondSnapshot, Finding } from "../../types/diamond"
import { checkVerified } from "../alerts/sourcify"
import { swarmEnabled, uploadToSwarm } from "../alerts/swarm"
import { arkivClients } from "../arkiv/write-checks"
import { fitStr } from "../util/fit-str"
import { classify, compareSnapshot, summarize } from "./compare"
import { readDiamond } from "./loupe"
import { readManifest } from "./manifest"
import { lookupSignatures } from "./signatures"
import { notifyDiamond } from "../notifications/events"

type Log = (line: string) => void

export type DiamondCheckOptions = {
  diamondId: string
  /** Chain id to inject a fake malicious facet on, without touching the real chain or manifest. */
  simulate?: number
  log?: Log
}

const SIMULATED_FACET = "0x000000000000000000000000000000000000dEaD" as Address
const SIMULATED_SIGNATURE = "emergencyWithdraw(address,uint256)"

export function findDiamond(diamondId: string) {
  const diamond = DIAMONDS.find((item) => item.id === diamondId)
  if (!diamond) throw new Error(`unknown diamond "${diamondId}"; expected one of: ${DIAMONDS.map((d) => d.id).join(", ")}`)
  return diamond
}

function injectSimulation(live: DiamondSnapshot): DiamondSnapshot {
  return {
    ...live,
    facets: [
      ...live.facets,
      {
        address: SIMULATED_FACET,
        codehash: keccak256(toHex("simulated malicious facet")),
        selectors: [toFunctionSelector(SIMULATED_SIGNATURE)],
      },
    ],
  }
}

/** Asks Sourcify about each new or changed facet on this chain, and names the selectors involved. */
async function enrich(findings: Finding[], chainId: number) {
  const facets = new Set(
    findings
      .filter((f) => f.facet && (f.kind === "unexpected-function" || f.kind === "facet-code-changed"))
      .map((f) => f.facet!),
  )
  const statuses = new Map<string, Finding["verified"]>()
  await Promise.all(
    [...facets].map(async (facet) => {
      const status = facet === SIMULATED_FACET ? "unverified" : await checkVerified(facet, chainId)
      statuses.set(facet.toLowerCase(), status)
    }),
  )

  const names = await lookupSignatures(findings.flatMap((f) => f.selectors))
  names.set(toFunctionSelector(SIMULATED_SIGNATURE), SIMULATED_SIGNATURE)

  for (const finding of findings) {
    if (finding.facet && statuses.has(finding.facet.toLowerCase())) {
      finding.verified = statuses.get(finding.facet.toLowerCase())
    }
    finding.signatures = finding.selectors.map((s) => names.get(s.toLowerCase()) ?? s)
  }
}

async function checkChain(
  address: Address,
  chainId: number,
  expected: DiamondSnapshot | undefined,
  simulate: boolean,
  log: Log,
): Promise<ChainResult> {
  const chain = diamondChain(chainId)?.name ?? String(chainId)
  const base = { chainId, chain, findings: [] as Finding[], facets: 0, selectors: 0 }

  let live: DiamondSnapshot
  try {
    live = await readDiamond(chainId, address)
  } catch (error) {
    log(`  ${chain}: unreachable (${error instanceof Error ? error.message.split("\n")[0] : error})`)
    return { ...base, verdict: "unreachable", severity: "warning", detail: "could not read the diamond loupe on this chain" }
  }
  if (simulate) live = injectSimulation(live)

  const counts = {
    facets: live.facets.length,
    selectors: live.facets.reduce((n, f) => n + f.selectors.length, 0),
  }
  if (!expected) {
    log(`  ${chain}: no manifest pinned for this chain`)
    return { ...base, ...counts, verdict: "unpinned", severity: "info", detail: "no manifest pinned for this chain" }
  }

  const findings = compareSnapshot(expected, live)
  await enrich(findings, chainId)
  const { verdict, severity } = classify(findings)
  const detail = `${simulate ? "SIMULATED: " : ""}${summarize(findings)}`
  log(`  ${chain}: ${verdict} [${severity}] ${detail}`)
  return { ...base, ...counts, findings, verdict, severity, detail }
}

/** Checks every chain of one diamond against its pinned manifest and writes one Arkiv entity per chain. */
export async function runDiamondCheck(options: DiamondCheckOptions): Promise<DiamondRun> {
  const log = options.log ?? (() => {})
  const diamond = findDiamond(options.diamondId)
  const manifest = await readManifest(diamond.id)
  if (!manifest) {
    throw new Error(`no manifest pinned for ${diamond.id}; run npm run diamond:pin -- ${diamond.id}`)
  }
  const simulate = options.simulate
  if (simulate !== undefined && !(diamond.chainIds as readonly number[]).includes(simulate)) {
    throw new Error(`simulate must be one of the diamond's chains: ${diamond.chainIds.join(", ")}`)
  }

  const address = getAddress(diamond.address)
  const run = Date.now()
  log(`${diamond.name} ${address} on ${diamond.chainIds.length} chains`)

  const results = await Promise.all(
    diamond.chainIds.map(async (chainId) => {
      const result = await checkChain(address, chainId, manifest.chains[String(chainId)], chainId === simulate, log)
      notifyDiamond(diamond.name, address, result, chainId === simulate)
      return result
    }),
  )

  let evidence = ""
  if (swarmEnabled()) {
    const reference = await uploadToSwarm(JSON.stringify({ diamond: diamond.id, address, run, results }))
    evidence = reference ?? ""
    if (reference) log(`  swarm evidence → bzz:${reference}`)
  }

  const clients = arkivClients()
  const expiration = ExpirationTime.fromDays(DIAMOND_CHECK_LIFETIME_DAYS)
  const { txHash } = await clients.walletClient.executeBatch({
    creates: results.map((result) => ({
      schema: DiamondChecks,
      values: {
        diamond: diamond.id,
        chainId: u64(BigInt(result.chainId)),
        chainName: result.chain,
        address: addr(address),
        verdict: result.verdict,
        severity: result.severity,
        run: u64(BigInt(run)),
        findings: u64(BigInt(result.findings.length)),
        detail: fitStr(result.detail),
        evidence,
      },
      expiration,
    })),
  })
  log(`wrote ${results.length} diamond.check entities in ${txHash}`)

  return {
    diamond: diamond.id,
    run: String(run),
    simulated: simulate ?? null,
    txHash,
    evidence,
    results,
  }
}
