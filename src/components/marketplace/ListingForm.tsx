import { useState } from "react"
import { useAccount } from "wagmi"
import { createListing } from "../../lib/marketplace/api"
import type { ListingDraft, ListingKind } from "../../types/marketplace"

const FIELD =
  "rounded-lg border border-line bg-ink px-3 py-2 text-sm tracking-normal text-zinc-100 normal-case"
const LABEL = "grid gap-1.5 text-[11px] tracking-[0.14em] text-zinc-500 uppercase"

export function ListingForm({ onCreated }: { onCreated: () => void }) {
  const { address, isConnected } = useAccount()
  const [kind, setKind] = useState<ListingKind>("data")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [category, setCategory] = useState("")
  const [priceTgml, setPriceTgml] = useState("")
  const [payload, setPayload] = useState("")
  const [proof, setProof] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!address) {
      setError("Connect a wallet first — it is the seller and payment address.")
      return
    }
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const draft: ListingDraft = {
        kind,
        title,
        summary,
        category,
        priceTgml,
        payTo: address,
        preview: summary,
        payload: kind === "compute" ? "verify-token" : payload,
        proof: proof.trim() || undefined,
      }
      const created = await createListing(draft)
      setDone(created.listingKey)
      setTitle("")
      setSummary("")
      setCategory("")
      setPriceTgml("")
      setPayload("")
      setProof("")
      onCreated()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "could not create listing")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-3 rounded-2xl border border-line bg-panel p-4 shadow-2xl" onSubmit={submit}>
      <p className="font-serif text-xl">List data or compute</p>

      <label className={LABEL}>
        Type
        <select className={FIELD} value={kind} onChange={(e) => setKind(e.target.value as ListingKind)}>
          <option value="data">Dataset</option>
          <option value="compute">Compute (verify a token)</option>
        </select>
      </label>

      <label className={LABEL}>
        Title
        <input className={FIELD} value={title} placeholder="Verified ERC-20 metadata set" onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className={LABEL}>
        Summary
        <input className={FIELD} value={summary} placeholder="120 tokens, all passing erc20 + eip1967" onChange={(e) => setSummary(e.target.value)} />
      </label>

      <label className={LABEL}>
        Category
        <input className={FIELD} value={category} placeholder="token-checks" onChange={(e) => setCategory(e.target.value)} />
      </label>

      <label className={LABEL}>
        Price (tGLM)
        <input className={`${FIELD} font-mono`} value={priceTgml} placeholder="0.5" inputMode="decimal" onChange={(e) => setPriceTgml(e.target.value)} />
      </label>

      {kind === "data" ? (
        <label className={LABEL}>
          Gated payload (revealed only after payment)
          <textarea
            className={`${FIELD} min-h-24 font-mono`}
            value={payload}
            placeholder="The dataset body, a download link, or an Arkiv query…"
            onChange={(e) => setPayload(e.target.value)}
          />
        </label>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-zinc-400">
          Compute listings run the DataVerify check pipeline on a token the buyer names, and return
          fresh erc20 / list-match / eip1967 results after payment.
        </p>
      )}

      <label className={LABEL}>
        Proof (optional — earns a trust badge)
        <input
          className={`${FIELD} font-mono`}
          value={proof}
          placeholder="token addresses to re-check, or an on-chain tx hash"
          onChange={(e) => setProof(e.target.value)}
        />
      </label>
      <p className="rounded-lg border border-dashed border-line px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
        The verifier runs at publish: token addresses are <b className="text-pass">re-checked on Ethereum</b>{" "}
        (✓ Verified if they pass), a tx hash is <b className="text-absent">confirmed on-chain</b> (⛓ Attested).
        No proof means <b className="text-mismatch">⚠ Self-reported</b> — buyers see the badge either way.
      </p>

      <button
        className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
        type="submit"
        disabled={busy || !isConnected}
      >
        {busy ? "Publishing…" : isConnected ? "Publish listing" : "Connect wallet to list"}
      </button>

      {error ? <p className="text-sm text-fail">{error}</p> : null}
      {done ? <p className="font-mono text-xs text-pass">listed · {done.slice(0, 10)}…</p> : null}
    </form>
  )
}
