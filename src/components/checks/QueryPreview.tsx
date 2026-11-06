import type { QueryPreviewProps } from "../../types/ui"

export function QueryPreview({ query }: QueryPreviewProps) {
  return (
    <pre className="mt-4 max-w-full overflow-x-auto rounded-2xl border border-line bg-panel px-3 py-3 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-zinc-400 sm:px-4 sm:text-xs sm:whitespace-pre">
      {query}
    </pre>
  )
}
