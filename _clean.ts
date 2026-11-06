import "dotenv/config"
import { asc, eq } from "@arkiv-network/sdk/query"
import { arkivClients } from "./src/lib/arkiv/write-checks"
import { AetheraReadings, Listings } from "./src/schema"
async function delAll(clients: any, schema: any, where?: any) {
  let n = 0
  for (;;) {
    let q = clients.publicClient.select({ $key: true }).from(schema).ownedBy(clients.account.address).orderBy(asc("$key")).limit(100)
    if (where) q = q.where(where)
    const page = await q.fetch()
    if (page.entities.length === 0) break
    for (const row of page.entities) { await clients.walletClient.deleteEntity({ entityKey: row.$key }); n++ }
    if (page.entities.length < 100) break
  }
  return n
}
async function main() {
  const clients = arkivClients()
  const r = await delAll(clients, AetheraReadings)
  const l = await delAll(clients, Listings, eq("category", "solar-oracle"))
  console.log(`deleted ${r} old readings, ${l} old solar-oracle listings`)
}
main().catch(e => { console.error(e); process.exit(1) })
