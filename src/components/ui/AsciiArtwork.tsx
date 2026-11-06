type Artwork = "shield" | "blocks" | "record" | "network"

const ART: Record<Artwork, string> = {
  shield: String.raw`      .--------.
     /  VERIFY  \\
    /  .-----.  \\
   |  /  ✓  /|  |
   | /_____/ |  |
   |  SHA256 |  |
    \\_______/  /
     '-------'`,
  blocks: String.raw`  ┌─────────┐
  │ 0x8b... │──┐
  └─────────┘  │
      ┌────────┴┐
      │ CHECKED │
      └────────┬┘
  ┌─────────┐  │
  │ 0xa1... │──┘
  └─────────┘`,
  record: String.raw`  ┌─────────────┐
  │  RECORD #42 │
  │             │
  │  ✓ SIGNED   │
  │  ● PUBLIC   │
  │  ◌ EXPIRES  │
  └─────────────┘`,
  network: String.raw`      ●──────●
     ╱ \\    ╱
    ●───●──●
     \\ ╱    \\
      ●──────●
       EVIDENCE`,
}

export function AsciiArtwork({ type, className = "" }: { type: Artwork; className?: string }) {
  return <pre className={`ascii-art ${className}`} aria-hidden="true">{ART[type]}</pre>
}
