import { sendTransaction, switchChain, waitForTransactionReceipt } from "@wagmi/core"
import { useEffect, useState, type ReactNode } from "react"
import { formatEther, isAddress } from "viem"
import { useAccount } from "wagmi"
import { APTOS_EXPLORER_TX } from "../../config"
import { useDataPower } from "../../hooks/useDataPower"
import { fetchPayload, settlePurchase } from "../../lib/marketplace/api"
import { arkivTimeoutMessage, browserClient } from "../../lib/arkiv/read-checks"
import type { DataPower } from "../../lib/marketplace/pricing"
import { readAttestations, readListings, readPurchases } from "../../lib/marketplace/marketplace"
import { rabdiChain, wagmiConfig } from "../../lib/wagmi"
import { shortAddress } from "../../lib/util/format"
import {
  EMPTY_LISTING_FILTERS,
  LISTING_KINDS,
  type AttestationRow,
  type ListingFilters,
  type ListingKind,
  type ListingRow,
  type PurchaseReceipt,
} from "../../types/marketplace"
import { ListingForm } from "./ListingForm"

const client = browserClient()

function priceLabel(priceWei: string): string {
  try {
    return `${formatEther(BigInt(priceWei))} tGLM`
  } catch {
    return "— tGLM"
  }
}

export function Marketplace() {
  const { address, isConnected } = useAccount()
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_LISTING_FILTERS)
  const [rows, setRows] = useState<ListingRow[]>([])
  const [attestations, setAttestations] = useState<Map<string, AttestationRow>>(new Map())
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)

  async function load(next: ListingFilters) {
    setLoading(true)
    setError(null)
    try {
      const [page, attests] = await Promise.all([readListings(client, next), readAttestations(client)])
      setRows(page.rows)
      setAttestations(attests)
    } catch (caught) {
      setRows([])
      setError(arkivTimeoutMessage(caught instanceof Error ? caught.message : "could not read listings"))
    } finally {
      setLoading(false)
    }
  }

  async function loadOwned() {
    if (!address) {
      setOwned(new Set())
      return
    }
    try {
      const purchases = await readPurchases(client, address)
      setOwned(new Set(purchases.map((purchase) => purchase.listingKey)))
    } catch {
      setOwned(new Set())
    }
  }

  useEffect(() => {
    void load(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.kind, filters.category])

  useEffect(() => {
    void loadOwned()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  const open = rows.find((listing) => listing.key === openKey) ?? null

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
      <div className="sticky top-4 grid gap-3">
        <div className="grid gap-3 rounded-2xl border border-line bg-panel p-4 shadow-2xl">
          <label className="grid gap-1.5 text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
            Type
            <select
              className="rounded-lg border border-line bg-ink px-3 py-2 text-sm tracking-normal text-zinc-100 normal-case"
              value={filters.kind}
              onChange={(e) => setFilters({ ...filters, kind: e.target.value as ListingKind | "" })}
            >
              <option value="">Any</option>
              {LISTING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
            Category
            <input
              className="rounded-lg border border-line bg-ink px-3 py-2 font-mono text-sm tracking-normal text-zinc-100 normal-case"
              value={filters.category}
              placeholder="token-checks"
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            />
          </label>
          <button
            className="rounded-lg border border-line px-3 py-2 text-sm"
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? "Hide listing form" : "Sell data or compute"}
          </button>
        </div>
        {showForm ? (
          <ListingForm
            onCreated={() => {
              setShowForm(false)
              void load(filters)
            }}
          />
        ) : null}
      </div>

      <section className="grid content-start gap-3 sm:grid-cols-2">
        {error ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-fail sm:col-span-2">{error}</p>
        ) : null}
        {loading ? (
          <p className="text-zinc-400">Reading listings from Arkiv…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-zinc-400 sm:col-span-2">
            No listings yet. Connect a wallet and publish the first one.
          </p>
        ) : (
          rows.map((listing) => (
            <ListingCard
              key={listing.key}
              listing={listing}
              attestation={attestations.get(listing.key)}
              owned={owned.has(listing.key)}
              onOpen={() => setOpenKey(listing.key)}
            />
          ))
        )}
      </section>

      {open ? (
        <ListingDialog onClose={() => setOpenKey(null)}>
          <ListingDetail
            listing={open}
            attestation={attestations.get(open.key)}
            owned={owned.has(open.key)}
            buyer={address}
            connected={isConnected}
            onPurchased={() => void loadOwned()}
            onClose={() => setOpenKey(null)}
          />
        </ListingDialog>
      ) : null}
    </div>
  )
}

function ListingDialog({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-10"
      onClick={onClose}
    >
      <div role="dialog" aria-modal="true" className="my-8 w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

type CardProps = {
  listing: ListingRow
  attestation?: AttestationRow
  owned: boolean
  onOpen: () => void
}

function ListingCard({ listing, attestation, owned, onOpen }: CardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid gap-3 rounded-2xl border border-line bg-panel p-4 text-left shadow-2xl transition hover:border-zinc-500"
    >
      <div className="flex flex-wrap items-center gap-2">
        <TrustBadge attestation={attestation} />
        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-accent">{listing.kind}</span>
        {owned ? <span className="font-mono text-[11px] text-pass">owned</span> : null}
      </div>
      <div>
        <h3 className="font-serif text-xl leading-tight">{listing.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{listing.summary}</p>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-lg text-accent">{priceLabel(listing.priceWei)}</span>
        <span className="font-mono text-[11px] text-zinc-500">Open →</span>
      </div>
    </button>
  )
}

type DetailProps = {
  listing: ListingRow
  attestation?: AttestationRow
  owned: boolean
  buyer?: `0x${string}`
  connected: boolean
  onPurchased: () => void
  onClose: () => void
}

const TRUST_BADGE: Record<string, { label: string; cls: string }> = {
  verified: { label: "✓ Verified", cls: "border-pass/50 text-pass" },
  attested: { label: "⛓ Attested", cls: "border-absent/50 text-absent" },
  "self-reported": { label: "⚠ Self-reported", cls: "border-mismatch/50 text-mismatch" },
}

function TrustBadge({ attestation }: { attestation?: AttestationRow }) {
  const tier = attestation?.tier ?? "self-reported"
  const badge = TRUST_BADGE[tier] ?? TRUST_BADGE["self-reported"]
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[11px] ${badge.cls}`}
      title={attestation?.detail ?? "no verifier attestation — treat as unverified"}
    >
      {badge.label}
    </span>
  )
}

function ListingDetail({ listing, attestation, owned, buyer, connected, onPurchased, onClose }: DetailProps) {
  const isCompute = listing.kind === "compute"
  const isOracle = listing.kind === "oracle"
  const [subject, setSubject] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<PurchaseReceipt | null>(null)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function buy() {
    if (!buyer) {
      setError("Connect a wallet to buy.")
      return
    }
    if (isCompute && !isAddress(subject)) {
      setError("Enter the token address to verify.")
      return
    }
    setBusy(true)
    setError(null)
    setReceipt(null)
    try {
      setStatus("Switching to Rabdi…")
      await switchChain(wagmiConfig, { chainId: rabdiChain.id })

      setStatus("Confirm the payment in your wallet…")
      const hash = await sendTransaction(wagmiConfig, {
        to: listing.payTo,
        value: BigInt(listing.priceWei),
      })

      setStatus("Waiting for the payment to confirm…")
      await waitForTransactionReceipt(wagmiConfig, { hash })

      setStatus("Unlocking…")
      const result = await settlePurchase({
        listingKey: listing.key,
        buyer,
        txHash: hash,
        subject: isCompute ? (subject as `0x${string}`) : undefined,
      })
      setReceipt(result)
      setStatus(null)
      onPurchased()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "purchase failed")
      setStatus(null)
    } finally {
      setBusy(false)
    }
  }

  async function reveal() {
    if (!buyer) return
    setBusy(true)
    setError(null)
    try {
      setRevealed(await fetchPayload(listing.key, buyer))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "could not reveal payload")
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="grid gap-3 rounded-2xl border border-line bg-panel p-4 shadow-2xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TrustBadge attestation={attestation} />
            <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-accent">
              {listing.kind}
            </span>
            {listing.category ? (
              <span className="font-mono text-[11px] text-zinc-500">{listing.category}</span>
            ) : null}
          </div>
          <h3 className="mt-2 font-serif text-xl leading-tight">{listing.title}</h3>
          <p className="mt-1 max-w-prose text-sm text-zinc-400">{listing.summary}</p>
          {attestation?.detail ? <p className="mt-1 text-xs text-zinc-500">{attestation.detail}</p> : null}
        </div>
        <div className="flex items-start gap-4">
          <div className="text-right">
            <p className="font-mono text-lg text-accent">{priceLabel(listing.priceWei)}</p>
            <p className="font-mono text-[11px] text-zinc-500">to {shortAddress(listing.payTo)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-zinc-300"
          >
            Close
          </button>
        </div>
      </header>

      {isOracle && !receipt ? <OraclePreview /> : null}

      {isCompute && !owned && !receipt ? (
        <input
          className="rounded-lg border border-line bg-ink px-3 py-2 font-mono text-sm text-zinc-100"
          value={subject}
          placeholder="Token address to verify (0x…)"
          onChange={(e) => setSubject(e.target.value)}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {owned ? (
          <>
            <span className="rounded-lg border border-pass px-3 py-2 text-sm text-pass">Owned ✓</span>
            {listing.kind === "data" ? (
              <button
                className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-60"
                type="button"
                onClick={() => void reveal()}
                disabled={busy}
              >
                Reveal dataset
              </button>
            ) : null}
          </>
        ) : (
          <button
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            type="button"
            onClick={() => void buy()}
            disabled={busy || !connected}
          >
            {busy ? "Working…" : connected ? `Buy · ${priceLabel(listing.priceWei)}` : "Connect to buy"}
          </button>
        )}
        {status ? <span className="text-sm text-zinc-400">{status}</span> : null}
      </div>

      {error ? <p className="text-sm text-fail">{error}</p> : null}

      {receipt?.payload || revealed ? (
        <pre className="overflow-x-auto rounded-lg border border-line bg-ink p-3 font-mono text-xs text-pass whitespace-pre-wrap">
          {receipt?.payload ?? revealed}
        </pre>
      ) : null}

      {receipt?.compute ? (
        <div className="rounded-lg border border-line bg-ink p-3">
          <p className="mb-2 font-mono text-xs text-zinc-500">verified {receipt.compute.subject}</p>
          <ul className="grid gap-1">
            {receipt.compute.results.map((r) => (
              <li key={r.check} className="font-mono text-xs">
                <span className="text-accent">{r.check}</span> · <b>{r.status}</b>{" "}
                <span className="text-zinc-400">{r.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {receipt?.oracle ? <OracleResult oracle={receipt.oracle} listingKey={listing.key} /> : null}

      {receipt?.dataset ? <DatasetResult dataset={receipt.dataset} /> : null}
    </article>
  )
}

/** Renders any provider-backed dataset generically from its column descriptors. */
function DatasetResult({ dataset }: { dataset: NonNullable<PurchaseReceipt["dataset"]> }) {
  const rows = dataset.records.slice(0, 30)

  function download() {
    const blob = new Blob([JSON.stringify(dataset.records, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${dataset.category}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-3 rounded-lg border border-accent/40 bg-ink p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-pass">
          ✓ {dataset.records.length} records · {dataset.title}
        </p>
        <button
          type="button"
          onClick={download}
          className="rounded border border-line px-2 py-1 font-mono text-[11px] text-zinc-300 hover:border-accent"
        >
          download JSON
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="text-left text-zinc-500">
              {dataset.columns.map((col) => (
                <th key={col.key} className={`py-1 pr-3 ${col.kind === "num" ? "text-right" : ""}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((record, i) => (
              <tr key={i} className="border-t border-line text-zinc-300">
                {dataset.columns.map((col) => (
                  <td key={col.key} className={`py-1 pr-3 ${col.kind === "num" ? "text-right" : ""}`}>
                    {col.kind === "url" ? (
                      <a
                        href={String(record[col.key])}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        open ↗
                      </a>
                    ) : col.kind === "mono" ? (
                      <span className="text-zinc-400">{formatCell(record[col.key])}</span>
                    ) : (
                      formatCell(record[col.key])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {dataset.records.length > rows.length ? (
          <p className="mt-1 font-mono text-[10px] text-zinc-600">
            showing {rows.length} of {dataset.records.length} — full set in the download
          </p>
        ) : null}
      </div>

      <p className="font-mono text-[11px] text-zinc-500">provenance: {dataset.provenanceNote}</p>
    </div>
  )
}

function formatCell(value: string | number | undefined): string {
  if (value === undefined || value === null) return "—"
  if (typeof value === "string" && value.length > 64) return value.slice(0, 10) + "…"
  return String(value)
}

/** Public provenance shown before purchase: proves the feed is real and attested on Arkiv. */
function OraclePreview() {
  const { readings, power, loading } = useDataPower()
  const latest = readings[0] ?? null
  const count = readings.length

  if (loading && count === 0) return null
  return (
    <div className="grid gap-2 rounded-lg border border-pass/30 bg-ink px-3 py-2 font-mono text-[11px]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-pass">✓ {count} readings attested on Arkiv</span>
        {latest ? (
          <span className="text-zinc-400">
            latest: {latest.site} · GHI {(Number(latest.ghiCenti) / 100).toFixed(2)} kWh/m²/day · proven on Aptos{" "}
            <a
              href={APTOS_EXPLORER_TX(latest.txHash)}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline-offset-2 hover:underline"
            >
              {latest.txHash.slice(0, 10)}↗
            </a>
          </span>
        ) : null}
      </div>
      {power ? <DataPowerBar power={power} /> : null}
    </div>
  )
}

/** Shows how the price is computed from the data — the Data Power Index breakdown. */
function DataPowerBar({ power }: { power: DataPower }) {
  const chips: Array<[string, number]> = [
    ["freshness", power.factors.freshness],
    ["coverage", power.factors.coverage],
    ["depth", power.factors.depth],
    ["integrity", power.factors.integrity],
    ["rarity", power.factors.rarity],
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-2 text-zinc-500">
      <span className="text-zinc-400">
        Data Power <span className="text-accent">{power.dpi}×</span> → price{" "}
        <span className="text-accent">{power.priceTgml} tGLM</span>
      </span>
      <span className="text-zinc-600">=</span>
      {chips.map(([label, value], i) => (
        <span key={label} title={`${label} factor`}>
          {i > 0 ? <span className="text-zinc-600">· </span> : null}
          {label} <span className="text-zinc-300">{value}×</span>
        </span>
      ))}
    </div>
  )
}

function OracleResult({
  oracle,
  listingKey,
}: {
  oracle: NonNullable<PurchaseReceipt["oracle"]>
  listingKey: string
}) {
  const readings = [...oracle.readings].sort((a, b) => b.observedAt - a.observedAt).slice(0, 12)
  const snippet = `// You own this feed. Pull it any time:
const res = await fetch("/api/payload?listingKey=${listingKey.slice(0, 10)}…&buyer=<you>")
const { readings } = await res.json()
// each: { site, lat, lon, irradiance, powerW, temperatureC, observedAt }`

  function download() {
    const blob = new Blob([JSON.stringify(oracle.readings, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "aethera-solar.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-3 rounded-lg border border-accent/40 bg-ink p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-pass">
          ✓ {oracle.readings.length} readings · feed {oracle.feed}
        </p>
        <button
          type="button"
          onClick={download}
          className="rounded border border-line px-2 py-1 font-mono text-[11px] text-zinc-300 hover:border-accent"
        >
          download JSON
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-1 pr-3">site</th>
              <th className="py-1 pr-3 text-right">DNI</th>
              <th className="py-1 pr-3 text-right">GHI</th>
              <th className="py-1 pr-3 text-right">lat-tilt</th>
              <th className="py-1 pr-3">Aptos proof</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r, i) => (
              <tr key={`${r.site}-${r.observedAt}-${i}`} className="border-t border-line text-zinc-300">
                <td className="py-1 pr-3">{r.site}</td>
                <td className="py-1 pr-3 text-right">{r.dni.toFixed(2)}</td>
                <td className="py-1 pr-3 text-right text-accent">{r.ghi.toFixed(2)}</td>
                <td className="py-1 pr-3 text-right">{r.latTilt.toFixed(2)}</td>
                <td className="py-1 pr-3">
                  <a
                    href={APTOS_EXPLORER_TX(r.txHash, r.network)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {r.txHash.slice(0, 10)}↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 font-mono text-[10px] text-zinc-600">irradiance in kWh/m²/day (NREL annual avg)</p>
      </div>

      <div>
        <p className="mb-1 font-mono text-[11px] text-zinc-500">
          how to use · provenance: query Arkiv schema{" "}
          <span className="text-accent">{oracle.provenanceSchema}</span>, each row linked to its Aptos tx
        </p>
        <pre className="overflow-x-auto rounded border border-line bg-panel p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-400">
          {snippet}
        </pre>
      </div>
    </div>
  )
}
