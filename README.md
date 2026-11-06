# DataVerify — token checks on Arkiv

Check Ethereum token metadata against a published token list, store each result
as an expiring **Arkiv** entity, and let anyone query what passed.

Built for **ETHweek — Build on Arkiv (from scratch)**.

```bash
npm install
cp .env.example .env     # PRIVATE_KEY funded at https://hub.arkiv.network/faucet
npm run verify           # read tokens, write dataverify.checks entities
npm run query            # read the mismatches back
npm run dev              # Verified checks tab
```

Checks stay queryable for a week. Indexed columns are chain, subject, check, and status.
