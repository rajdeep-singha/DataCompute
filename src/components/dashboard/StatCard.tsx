import type { ReactNode } from "react"
export function StatCard({ label, value, detail, icon }: { label: string; value: ReactNode; detail: string; icon: ReactNode }) {
  return <article className="dashboard-stat"><div><span>{label}</span>{icon}</div><strong>{value}</strong><p>{detail}</p></article>
}
