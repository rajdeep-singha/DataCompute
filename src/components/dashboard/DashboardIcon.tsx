const paths: Record<string, string> = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  alerts: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  diamond: "m12 3 9 8-9 10-9-10 9-8Z M3 11h18 M8 4l4 17 4-17",
  checks: "M9 4h10v17H5V4h4 M9 2h6v4H9z M8 12l2 2 5-5 M8 18h8",
  market: "M3 9h18l-2-6H5L3 9Z M4 9v12h16V9 M9 21v-7h6v7",
  docs: "M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16",
  menu: "M4 6h16 M4 12h16 M4 18h16",
}
export function DashboardIcon({ name }: { name: string }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.overview} /></svg>
}
