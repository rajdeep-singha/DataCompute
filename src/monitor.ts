import "dotenv/config"
process.env.MONITOR_ENABLED = "true"
await import("../server/index")
