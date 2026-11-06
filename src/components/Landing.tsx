import { WATCHLIST } from "../config"
import { useDataPower } from "../hooks/useDataPower"

type Tab = "alerts" | "marketplace"

const STEPS = [
  {
    n: "01",
    title: "Read the slot",
    body: "The watcher reads each proxy's implementation slot on Ethereum — EIP-1967 and the legacy OpenZeppelin slot, so USDC is covered too.",
  },
  {
    n: "02",
    title: "Ask Sourcify",
    body: "When the implementation changes, it asks Sourcify whether the new code is verified. A swap to unverified code is the red flag.",
  },
  {
    n: "03",
    title: "Write to Arkiv",
    body: "It writes an upgrade alert as an Arkiv entity — owned by the watcher wallet, expiring in 30 days, queryable by anyone. Evidence is pinned to Swarm.",
  },
] as const

const LEGEND = [
  { sev: "critical", tone: "text-fail border-fail/40", desc: "new code is unverified" },
  { sev: "warning", tone: "text-mismatch border-mismatch/40", desc: "verified change" },
  { sev: "info", tone: "text-absent border-absent/40", desc: "baseline observation" },
] as const

export function Landing({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  return (
    <div className="grid gap-10">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-panel px-6 py-12 shadow-2xl sm:px-10 sm:py-16">
        <div
          className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--color-accent), transparent 70%)" }}
        />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-fail" />
            watching {WATCHLIST.length} high-value proxies on Ethereum
          </span>
          <h2 className="mt-5 font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Did a contract you trust just upgrade to{" "}
            <span className="text-fail">unverified code?</span>
          </h2>
          <p className="mt-5 max-w-xl text-lg text-zinc-400">
            DataVerify watches upgradeable contracts like USDC, Aave and Compound. The moment a proxy's
            implementation changes, it checks Sourcify and records a signed, expiring, publicly-queryable
            alert on Arkiv.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate("alerts")}
              className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-ink transition hover:brightness-110"
            >
              View live alerts →
            </button>
            <a
              href="https://rabdi.explorer.arkiv.network"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-line px-5 py-2.5 text-sm text-zinc-300 transition hover:border-accent"
            >
              Alerts live on Arkiv (Rabdi)
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.n} className="grid gap-3 rounded-2xl border border-line bg-panel p-6 shadow-xl">
            <span className="font-mono text-sm text-accent">{step.n}</span>
            <h3 className="font-serif text-2xl">{step.title}</h3>
            <p className="text-sm leading-relaxed text-zinc-400">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 rounded-2xl border border-line bg-panel p-6 shadow-xl lg:grid-cols-[1fr_1fr]">
        <div>
          <h3 className="font-serif text-2xl">Severity</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Every alert is classified by how much it should worry you.
          </p>
          <ul className="mt-4 grid gap-2">
            {LEGEND.map((row) => (
              <li
                key={row.sev}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${row.tone}`}
              >
                <span className="font-mono text-sm">{row.sev}</span>
                <span className="text-sm text-zinc-400">— {row.desc}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-serif text-2xl">On the watchlist</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Adding a proxy is one line — the watcher handles both slot standards.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {WATCHLIST.map((item) => (
              <span
                key={item.address}
                className="rounded-full border border-line px-3 py-1.5 font-mono text-xs text-zinc-300"
              >
                {item.name}
              </span>
            ))}
          </div>
          <p className="mt-6 font-mono text-xs text-zinc-500">
            evidence (bytecode + Sourcify metadata) pinned to Swarm · alerts expire in 30 days
          </p>
        </div>
      </section>

      <AetheraShowcase onOpen={() => onNavigate("marketplace")} />
    </div>
  )
}

const SOLAR = "#f0c36a"

/** The same trust layer, applied to real-world data: a visually rich marketplace band. */
function AetheraShowcase({ onOpen }: { onOpen: () => void }) {
  const { readings, power } = useDataPower()
  const ghi = (centi: bigint) => Number(centi) / 100
  const maxGhi = Math.max(1, ...readings.map((r) => ghi(r.ghiCenti)))

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-line bg-panel p-6 shadow-2xl sm:p-8"
      style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${SOLAR} 7%, var(--color-panel)), var(--color-panel) 60%)` }}
    >
      <div
        className="pointer-events-none absolute -top-16 -left-10 h-60 w-60 rounded-full opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, ${SOLAR}, transparent 70%)` }}
      />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs"
            style={{ borderColor: `color-mix(in srgb, ${SOLAR} 40%, transparent)`, color: SOLAR }}
          >
            ☀ the same trust layer, for real-world data
          </span>
          <h3 className="mt-4 font-serif text-4xl leading-tight">Aethera Solar Oracle</h3>
          <p className="mt-3 max-w-md text-zinc-400">
            A marketplace for data you can't get free — NREL irradiance for real solar sites, pushed
            on-chain to <b className="text-zinc-200">Aptos</b> and re-attested on{" "}
            <b className="text-zinc-200">Arkiv</b>. Every reading carries its own on-chain proof, and
            the price is computed from the data's own power.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpen}
              className="rounded-xl px-5 py-2.5 font-semibold text-ink transition hover:brightness-110"
              style={{ background: SOLAR }}
            >
              Browse the marketplace →
            </button>
            {power ? (
              <span className="font-mono text-xs text-zinc-400">
                priced by Data Power <span style={{ color: SOLAR }}>{power.dpi}×</span> ={" "}
                <span style={{ color: SOLAR }}>{power.priceTgml} tGLM</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2">
          {readings.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500">loading attested readings…</p>
          ) : (
            readings.slice(0, 3).map((r) => (
              <div
                key={r.key}
                className="grid gap-1 rounded-xl border border-line bg-ink/70 px-4 py-3"
              >
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-zinc-200">{r.site}</span>
                  <span className="text-zinc-400">{ghi(r.ghiCenti).toFixed(2)} kWh/m²/day</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(ghi(r.ghiCenti) / maxGhi) * 100}%`, background: SOLAR }}
                  />
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
                  <span>DNI {(Number(r.dniCenti) / 100).toFixed(2)} · tilt {(Number(r.latTiltCenti) / 100).toFixed(2)}</span>
                  <span className="text-pass">✓ Aptos {r.txHash.slice(0, 8)}…</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
