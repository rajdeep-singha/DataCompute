export const DASHBOARD_NAV = [
  { to: "/home", label: "Overview", icon: "overview", description: "Your verification workspace" },
  { to: "/alerts", label: "Upgrade alerts", icon: "alerts", description: "Follow contract implementation changes" },
  { to: "/diamond", label: "Diamond inspector", icon: "diamond", description: "Compare facets against a trusted manifest" },
  { to: "/checks", label: "Token checks", icon: "checks", description: "Explore public verification records" },
  { to: "/marketplace", label: "Data marketplace", icon: "market", description: "Discover attested real-world data" },
  { to: "/docs", label: "Documentation", icon: "docs", description: "Understand the verification process" },
] as const
