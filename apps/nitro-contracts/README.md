# NitroBet contracts (Phase 2, testnet)

`src/NitroBetMarket.sol`: one contract, many parimutuel markets, settled in the USDT0 **ERC-20** (6 decimals).
Native gas value is never accepted or sent. Not upgradeable.

## How a market works
1. **Owner** (`createMarket`): outcomes (2-32), close time, fee (max 10%, fixed here), min bet, max bet, max pool.
2. **Players** (`stake`): need a server-signed EIP-712 `StakePermit` (user, market, outcome, amount, nonce, deadline)
   and a token approval. Winners share `pool - fee` in proportion to their stake (rounded down).
3. **Resolver** (the Safe 2-of-3): `resolve` after close, within 7 days. For 24h after that it may correct (`resolve`)
   or cancel (`voidMarket`) the result. After 24h the result is final.
4. **Winners** `claim`. **Owner** `withdrawFees` (once per market, never for voided / no-contest markets).
5. **Refunds**: `voidMarket` by the resolver, or anyone (`triggerRefund` / `refund`) once a market is still unresolved
   7 days after close. Then each player calls `refund`.

`pause` stops `createMarket` and `stake` only. `resolve`, `voidMarket`, `claim`, `refund`, `withdrawFees` always work.

## Rules worth knowing
- **No contest**: if nobody backed the winner, or everybody did, there is no losing side. Everyone is refunded, no fee.
- If the losing pool is smaller than the fee, winners get back less than their stake (fee is 5% of the whole pool).
- Rounding dust (less than 1 unit per winner) stays in the contract.
- `resolver` is fixed at deploy. Owner is two-step (`Ownable2Step`), renounce is disabled.
- The permit signer is the NitroBet server key. The owner can rotate it, never set it to zero.
- n8n only announces results and prepares a proposal. It holds no key that can resolve markets.

## Run the tests
Phone: push to GitHub, the **contracts** workflow runs `forge test` (unit + fuzz). Green tick = pass.
Locally: `forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.1.0 foundry-rs/forge-std@v1.9.4 && forge test`

## Deploy to testnet
Actions tab, **deploy-testnet**, Run workflow. Inputs: chain id and the USDT0 testnet token address
(verify both at docs.stable.xyz). Secrets: `TESTNET_RPC_URL`, `TESTNET_DEPLOYER_KEY` (throwaway key, funded from
https://faucet.stable.xyz/). Optional repo variables: `NITRO_OWNER`, `NITRO_RESOLVER`, `NITRO_PERMIT_SIGNER`,
`NITRO_FEE_RECIPIENT` (default to the deployer, testnet only).
The script refuses to run if the chain id differs or the token does not have 6 decimals.

Before mainnet: audit, a real Safe as resolver and owner, a licence and ID checks.
