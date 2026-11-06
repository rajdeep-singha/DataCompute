import { ExpirationTime, InvalidExpiryError } from "@arkiv-network/sdk"
import { asc } from "@arkiv-network/sdk/query"
import { addr, u64 } from "@arkiv-network/sdk/schema"
import { getAddress, isAddressEqual, type Address, type Hex } from "viem"
import { ALERT_LIFETIME_DAYS, WATCHLIST, ZERO_ADDRESS } from "../../config"
import { UpgradeAlerts, WatchState } from "../../schema"
import type { Severity, WatchResult, WatchRun } from "../../types/alert"
import { ethereumClient, readProxyImplementation } from "../eth/ethereum"
import { buildEvidence } from "./evidence"
import { fitStr } from "../util/fit-str"
import { checkVerified, type VerifiedStatus } from "./sourcify"
import { swarmEnabled, uploadToSwarm } from "./swarm"
import { arkivClients } from "../arkiv/write-checks"
import { notifyProxy } from "../notifications/events"

type Eth = ReturnType<typeof ethereumClient>
type Clients = ReturnType<typeof arkivClients>
type Log = (line: string) => void

export type WatchOptions = {
  /** Proxy name from the watchlist to force a fake critical upgrade for, without touching real state. */
  simulate?: string
  log?: Log
}

const expiration = ExpirationTime.fromDays(ALERT_LIFETIME_DAYS)
const SIMULATED_IMPL = "0x000000000000000000000000000000000000dEaD" as Address

/** The watcher's last-seen implementation per proxy, so a change is a diff. */
async function loadState(clients: Clients) {
  const state = new Map<string, { entityKey: Hex; impl: Address }>()
  const page = await clients.publicClient
    .select({ $key: true, proxy: true, impl: true })
    .from(WatchState)
    .ownedBy(clients.account.address)
    .orderBy(asc("$key"))
    .limit(100)
    .fetch()
  for (const row of page.entities) {
    state.set(row.proxy.value.toLowerCase(), {
      entityKey: row.$key,
      impl: getAddress(row.impl.value),
    })
  }
  return state
}

function severityFor(verified: VerifiedStatus, baseline: boolean): Severity {
  if (baseline) return "info"
  if (verified === "unverified") return "critical"
  return "warning"
}

/** Builds the evidence bundle and uploads it to Swarm, returning the bzz reference (or ""). */
async function evidenceReference(
  eth: Eth,
  log: Log,
  args: {
    proxy: Address
    proxyName: string
    block: bigint
    oldImpl: Address
    newImpl: Address
    verified: VerifiedStatus
  },
): Promise<string> {
  if (!swarmEnabled()) return ""
  const bundle = await buildEvidence(eth, args)
  const reference = await uploadToSwarm(JSON.stringify(bundle))
  if (reference) log(`  swarm evidence → bzz:${reference}`)
  return reference ?? ""
}

async function writeAlert(
  clients: Clients,
  log: Log,
  args: {
    proxy: Address
    proxyName: string
    oldImpl: Address
    newImpl: Address
    verified: VerifiedStatus
    severity: Severity
    block: bigint
    detail: string
    evidence: string
  },
): Promise<Hex> {
  const result = await clients.walletClient.createEntity(
    UpgradeAlerts,
    {
      proxy: addr(args.proxy),
      proxyName: fitStr(args.proxyName),
      oldImpl: addr(args.oldImpl),
      newImpl: addr(args.newImpl),
      verified: args.verified,
      severity: args.severity,
      block: u64(args.block),
      detail: fitStr(args.detail),
      evidence: args.evidence,
    },
    { expiration },
  )
  log(`  alert [${args.severity}] ${args.proxyName} → ${result.txHash}`)
  return result.txHash
}

async function upsertState(
  clients: Clients,
  prior: { entityKey: Hex } | undefined,
  args: { proxy: Address; proxyName: string; impl: Address; block: bigint },
) {
  const values = {
    proxy: addr(args.proxy),
    proxyName: fitStr(args.proxyName),
    impl: addr(args.impl),
    block: u64(args.block),
  }
  if (!prior) {
    await clients.walletClient.createEntity(WatchState, values, { expiration })
    return
  }
  await clients.walletClient.patchEntity(WatchState, prior.entityKey, { set: values })
  try {
    await clients.walletClient.extendEntity({ entityKey: prior.entityKey, expiration })
  } catch (error) {
    if (!(error instanceof InvalidExpiryError)) throw error
  }
}

/** Deletes every alert and state entity the watcher owns, for a clean re-baseline. */
export async function resetWatcher(log: Log = console.log) {
  const clients = arkivClients()
  for (const schema of [UpgradeAlerts, WatchState]) {
    for (;;) {
      const page = await clients.publicClient
        .select({ $key: true })
        .from(schema)
        .ownedBy(clients.account.address)
        .orderBy(asc("$key"))
        .limit(100)
        .fetch()
      if (page.entities.length === 0) break
      for (const row of page.entities) {
        await clients.walletClient.deleteEntity({ entityKey: row.$key })
      }
      log(`  deleted ${page.entities.length} ${schema.name} entities`)
      if (page.entities.length < 100) break
    }
  }
}

/** One watcher pass over the watchlist. Writes alerts and state to Arkiv as the watcher wallet. */
export async function runWatch(options: WatchOptions = {}): Promise<WatchRun> {
  const log = options.log ?? (() => {})
  const simulate = options.simulate?.toLowerCase()
  const clients = arkivClients()
  const eth = ethereumClient()

  const block = await eth.getBlockNumber()
  log(`watcher ${clients.account.address}`)
  log(`reading Ethereum at block ${block}, ${WATCHLIST.length} proxies, swarm ${swarmEnabled() ? "on" : "off"}`)

  const state = await loadState(clients)
  const results: WatchResult[] = []

  for (const item of WATCHLIST) {
    const proxy = getAddress(item.address)
    const { implementation, slot } = await readProxyImplementation(eth, proxy)
    if (!implementation) {
      log(`  ${item.name}: no implementation slot found, skipping`)
      results.push({ name: item.name, proxy, outcome: "skipped", implementation: null })
      continue
    }

    if (simulate && item.name.toLowerCase() === simulate) {
      notifyProxy({ proxy, name: item.name, oldImpl: implementation, newImpl: SIMULATED_IMPL, block,
        verified: "unverified", severity: "critical", simulated: true })
      const evidence = await evidenceReference(eth, log, {
        proxy,
        proxyName: item.name,
        block,
        oldImpl: implementation,
        newImpl: SIMULATED_IMPL,
        verified: "unverified",
      })
      const txHash = await writeAlert(clients, log, {
        proxy,
        proxyName: item.name,
        oldImpl: implementation,
        newImpl: SIMULATED_IMPL,
        verified: "unverified",
        severity: "critical",
        block,
        detail: `SIMULATED upgrade to unverified code at ${SIMULATED_IMPL}`,
        evidence,
      })
      results.push({
        name: item.name,
        proxy,
        outcome: "simulated",
        implementation: SIMULATED_IMPL,
        verified: "unverified",
        severity: "critical",
        txHash,
      })
      continue
    }

    const prior = state.get(proxy.toLowerCase())
    if (prior && isAddressEqual(prior.impl, implementation)) {
      log(`  ${item.name}: unchanged (${implementation})`)
      // Reconcile the notification baseline too (e.g. after a failed Arkiv write
      // followed by a return to the old implementation).
      notifyProxy({ proxy, name: item.name, oldImpl: implementation, newImpl: implementation,
        block, verified: "unknown", severity: "info", baseline: true })
      await upsertState(clients, prior, { proxy, proxyName: item.name, impl: implementation, block })
      results.push({ name: item.name, proxy, outcome: "unchanged", implementation })
      continue
    }

    const verified = await checkVerified(implementation)
    const baseline = !prior
    const severity = severityFor(verified, baseline)
    const oldImpl = prior?.impl ?? (ZERO_ADDRESS as Address)
    const detail = baseline
      ? `baseline: now watching ${slot} proxy at ${implementation} (${verified})`
      : `implementation changed to ${implementation} (${verified})`

    // Persist delivery intent before optional evidence uploads or Arkiv writes.
    notifyProxy({ proxy, name: item.name, oldImpl, newImpl: implementation, block, verified, severity, baseline })

    const evidence = await evidenceReference(eth, log, {
      proxy,
      proxyName: item.name,
      block,
      oldImpl,
      newImpl: implementation,
      verified,
    })
    const txHash = await writeAlert(clients, log, {
      proxy,
      proxyName: item.name,
      oldImpl,
      newImpl: implementation,
      verified,
      severity,
      block,
      detail,
      evidence,
    })
    await upsertState(clients, prior, { proxy, proxyName: item.name, impl: implementation, block })
    results.push({
      name: item.name,
      proxy,
      outcome: baseline ? "baseline" : "upgraded",
      implementation,
      verified,
      severity,
      txHash,
    })
  }

  log("done")
  return {
    watcher: clients.account.address,
    block: block.toString(),
    swarm: swarmEnabled(),
    results,
  }
}
