import assert from "node:assert/strict"
import test from "node:test"
import { buildChecks } from "./checks"
import type { ListedToken } from "../../types/check"

const listed: ListedToken = {
  chainId: 1,
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
}

const zero = "0x0000000000000000000000000000000000000000" as const
const impl = "0x43506849D7C04F9138D1A2050bbF3A0c054402dd" as const
const readable = {
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  nameError: null,
  symbolError: null,
  decimalsError: null,
}

test("a matching token passes erc20 and list-match", () => {
  const [erc20, listMatch, proxy] = buildChecks(listed, readable, null, false)
  assert.equal(erc20?.status, "pass")
  assert.equal(listMatch?.status, "pass")
  assert.equal(proxy?.status, "absent")
  assert.equal(proxy?.implementation, zero)
})

test("decimals that disagree with the list are a mismatch", () => {
  const [, listMatch] = buildChecks(listed, { ...readable, decimals: 18 }, null, false)
  assert.equal(listMatch?.status, "mismatch")
  assert.match(listMatch?.detail ?? "", /decimals chain 18 list 6/)
})

test("unreadable metadata fails both metadata checks", () => {
  const [erc20, listMatch] = buildChecks(
    listed,
    {
      name: null,
      symbol: null,
      decimals: null,
      nameError: "name() reverted",
      symbolError: "symbol() reverted",
      decimalsError: "decimals() reverted",
    },
    null,
    false,
  )
  assert.equal(erc20?.status, "fail")
  assert.equal(listMatch?.status, "fail")
  assert.equal(erc20?.symbol, "USDC")
  assert.equal(erc20?.decimals, -1)
})

test("an implementation with code is a proxy pass", () => {
  const [, , proxy] = buildChecks(listed, readable, impl, true)
  assert.equal(proxy?.status, "pass")
  assert.equal(proxy?.implementation, impl)
})
