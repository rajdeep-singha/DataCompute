import { AETHERA_PRICING } from "../config"
import { useDataPower } from "../hooks/useDataPower"

const ASSETS = [
  ["Solar Oracle", "NREL irradiance (DNI/GHI/lat-tilt), proven on Aptos", "oracle"],
  ["Research Intelligence", "classified RWA/carbon/DePIN news, relevance-scored", "dataset"],
  ["Admin-Risk feed", "proxy upgrades + Sourcify status, signed on Arkiv", "dataset"],
  ["DePIN Registry", "aggregate installer/project growth (no PII)", "dataset"],
  ["Rug-Risk score", "on-demand token risk — you name the token", "compute"],
] as const

const SCHEMAS = [
  ["dataverify.checks", "token checks (erc20 / list-match / eip1967)"],
  ["upgrade.alert", "proxy upgrade alerts"],
  ["upgrade.state", "last-seen implementation per proxy"],
  ["aethera.solar", "attested solar readings (NREL → Aptos → Arkiv)"],
  ["dataverify.listings", "marketplace listings (all asset types)"],
  ["dataverify.purchases", "confirmed purchases"],
] as const

function Section({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-panel p-6 shadow-xl">
      <div>
        <p className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">{kicker}</p>
        <h2 className="mt-1 font-serif text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-line bg-ink p-4 font-mono text-xs leading-relaxed text-zinc-300 whitespace-pre">
      {children}
    </pre>
  )
}

export function Docs() {
  const { power } = useDataPower()

  return (
    <div className="grid gap-6">
      <header className="max-w-2xl">
        <h1 className="font-serif text-4xl tracking-tight">Formulas &amp; models</h1>
        <p className="mt-3 text-zinc-400">
          Every number DataVerify produces is computed, not hand-set. This page is the reference:
          how prices, severities and verification verdicts are derived.
        </p>
      </header>

      <Section kicker="pricing" title="Data Power Index">
        <p className="text-sm text-zinc-400">
          A dataset&rsquo;s price is the base price scaled by how valuable the data measurably is.
          Five dimensionless factors compose multiplicatively; verifiable data earns a premium, which
          is the whole point of DataVerify.
        </p>
        <Formula>{`price = basePrice · φ · γ · δ · ι · ρ        DPI = φ · γ · δ · ι · ρ

φ  freshness  = 2^(−ageDays / halfLife)        clamp 0.1–1   recent data worth more
γ  coverage   = 1 + 0.5 · log2(sites)                        more locations ↑ (diminishing)
δ  depth      = 1 + 0.1 · log10(readings)                    more data points ↑ (diminishing)
ι  integrity  = completeness · (1 + 0.5 · proven)            quality × on-chain-proof premium
ρ  rarity     = per-dataset constant                         scarce (not free) > public`}</Formula>
        <div className="grid gap-1 font-mono text-xs text-zinc-400">
          <p>
            <span className="text-zinc-500">completeness</span> = share of expected fields present ·{" "}
            <span className="text-zinc-500">proven</span> = share of readings with a valid on-chain
            (Aptos) tx
          </p>
          <p>
            Aethera constants: basePrice ={" "}
            <span className="text-accent">{AETHERA_PRICING.basePriceTgml} tGLM</span> · halfLife ={" "}
            <span className="text-accent">{AETHERA_PRICING.halfLifeDays}d</span> · rarity ={" "}
            <span className="text-accent">{AETHERA_PRICING.rarity}×</span>
          </p>
        </div>
        {power ? (
          <div className="rounded-xl border border-accent/30 bg-ink p-4">
            <p className="mb-2 font-mono text-[11px] text-zinc-500">live, from the current Aethera feed:</p>
            <p className="font-mono text-sm">
              DPI <span className="text-accent">{power.dpi}×</span> → price{" "}
              <span className="text-accent">{power.priceTgml} tGLM</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-zinc-400">
              <span>φ freshness {power.factors.freshness}×</span>
              <span>γ coverage {power.factors.coverage}×</span>
              <span>δ depth {power.factors.depth}×</span>
              <span>ι integrity {power.factors.integrity}×</span>
              <span>ρ rarity {power.factors.rarity}×</span>
            </div>
            <p className="mt-2 font-mono text-[11px] text-zinc-500">
              {power.stats.items} items · {power.stats.groups} groups · {power.stats.ageDays}d old ·{" "}
              completeness {power.stats.completeness} · provenance {power.stats.provenance}
            </p>
          </div>
        ) : null}
      </Section>

      <Section kicker="marketplace" title="Marketplace assets">
        <p className="text-sm text-zinc-400">
          Every listing sells data that isn&rsquo;t free, priced by the same Data Power formula. New
          assets plug in as a single provider — one pattern, not a bespoke integration each time.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {ASSETS.map(([name, desc, kind]) => (
                <tr key={name} className="border-t border-line">
                  <td className="py-2 pr-4 font-serif text-base text-zinc-100">{name}</td>
                  <td className="py-2 pr-4 text-zinc-400">{desc}</td>
                  <td className="py-2 font-mono text-[11px] text-accent">{kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section kicker="trust" title="Listing verifier">
        <p className="text-sm text-zinc-400">
          Anyone can list data — but nobody gets to just claim it&rsquo;s &ldquo;verified.&rdquo; A
          verifier runs at publish time and every listing carries an honest trust badge, stored as its
          own Arkiv attestation.
        </p>
        <div className="grid gap-2">
          {[
            ["✓ Verified", "text-pass border-pass/40", "the platform re-ran a real check that passed — e.g. token addresses re-checked on Ethereum"],
            ["⛓ Attested", "text-absent border-absent/40", "the seller gave an on-chain proof (tx hash) the platform confirmed exists"],
            ["⚠ Self-reported", "text-mismatch border-mismatch/40", "no verifiable proof — the badge says so, so buyers aren't misled"],
          ].map(([label, tone, meaning]) => (
            <div key={label} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 ${tone}`}>
              <span className="font-mono text-xs">{label}</span>
              <span className="text-sm text-zinc-400">— {meaning}</span>
            </div>
          ))}
        </div>
        <p className="font-mono text-[11px] text-zinc-500">
          a listing&rsquo;s title can say &ldquo;verified&rdquo; — the badge is computed, so it tells the truth regardless.
        </p>
      </Section>

      <Section kicker="security" title="Upgrade severity">
        <p className="text-sm text-zinc-400">
          Each detected proxy upgrade is classified by how much it should worry you. Severity is a
          pure function of the Sourcify verdict on the new implementation.
        </p>
        <Formula>{`severity(verified, isBaseline) =
    isBaseline              → info        first time a proxy is observed
    verified = unverified   → critical    swap to code Sourcify can't match  ← the red flag
    otherwise               → warning     a change to verified code`}</Formula>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["exact_match", "bytecode + metadata match exactly", "text-pass"],
            ["match", "partial / verified with minor diffs", "text-pass"],
            ["unverified", "Sourcify has no match → critical", "text-fail"],
            ["unknown", "Sourcify unreachable; no claim made", "text-zinc-400"],
          ].map(([state, meaning, tone]) => (
            <div key={state} className="rounded-xl border border-line bg-ink px-3 py-2 font-mono text-xs">
              <span className={tone}>{state}</span>
              <span className="text-zinc-500"> — {meaning}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="trust" title="Provenance chain">
        <p className="text-sm text-zinc-400">
          The marketplace sells data a buyer can verify end to end. For the Aethera feed, provenance
          flows across two chains before it&rsquo;s sold:
        </p>
        <Formula>{`NREL  →  Aptos  →  Arkiv  →  buyer
 │        │         │
 │        │         └ queryable attestation (schema aethera.solar), each row carries the Aptos tx
 │        └ source of truth: reading pushed on-chain, tx_hash is the proof
 └ raw solar irradiance (DNI / GHI / lat-tilt, kWh/m²/day)`}</Formula>
        <p className="font-mono text-xs text-zinc-500">
          The <span className="text-accent">proven</span> factor in the price formula counts exactly
          these on-chain proofs — so the more verifiable the feed, the more it&rsquo;s worth.
        </p>
      </Section>

      <Section kicker="arkiv" title="How Arkiv is used">
        <p className="text-sm text-zinc-400">
          Arkiv is a database (queryable, time-scoped, tamper-evident entities) — not a marketplace.
          The marketplace is built <em>on</em> it. Three Arkiv features do load-bearing work:
        </p>
        <ul className="grid gap-2 text-sm text-zinc-400">
          <li>
            <b className="text-zinc-200">Ownership</b> — writes are signed by a known wallet; reads are
            scoped with <code className="font-mono text-accent">ownedBy</code>, so forged rows can&rsquo;t
            appear in a feed.
          </li>
          <li>
            <b className="text-zinc-200">Expiry</b> — entities carry a TTL, so feeds are rolling windows
            (alerts ~30d, readings ~7d) that prune themselves.
          </li>
          <li>
            <b className="text-zinc-200">Filtering</b> — indexed columns make{" "}
            <code className="font-mono text-accent">where</code> /{" "}
            <code className="font-mono text-accent">orderBy</code> queries cheap and public.
          </li>
        </ul>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs">
            <tbody>
              {SCHEMAS.map(([name, desc]) => (
                <tr key={name} className="border-t border-line">
                  <td className="py-1.5 pr-4 text-accent">{name}</td>
                  <td className="py-1.5 text-zinc-400">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
