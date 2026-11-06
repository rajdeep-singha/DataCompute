import type { QueryPreviewProps } from "../../types/ui"

export function QueryPreview({ query }: QueryPreviewProps) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-2xl border border-line bg-panel px-4 py-3 font-mono text-xs leading-relaxed text-zinc-400">
      {query}
    </pre>
  )
}
