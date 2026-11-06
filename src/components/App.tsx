import { useState } from "react"
import { ChecksViewer } from "./checks/ChecksViewer"

const TABS = [{ id: "checks", label: "Verified checks" }] as const

type Tab = (typeof TABS)[number]["id"]

export function App() {
  const [tab, setTab] = useState<Tab>("checks")

  return (
    <main className="mx-auto w-[min(1180px,calc(100%-2rem))] py-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={() => setTab("checks")} className="font-serif text-2xl tracking-tight">
          DataVerify
        </button>
        <nav className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                tab === item.id
                  ? "border-accent bg-accent font-semibold text-ink"
                  : "border-line text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <span className="hidden rounded-full border border-line px-3 py-1.5 font-mono text-[11px] text-zinc-500 sm:inline">
          Build on Arkiv · ETHweek
        </span>
      </header>
      <ChecksViewer />
    </main>
  )
}
