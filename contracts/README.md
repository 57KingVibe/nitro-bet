# NitroBet Full: smart contract (v1)

`src/NitroBetMarket.sol` is a parimutuel market paid in USDT0 on the Stable chain. Not audited. Testnet only until it is.

## Rules in one minute
- Players stake USDT0 on one outcome. Winners share the losing side's pool.
- Fee: 5% of the **losing side only** (set per market, hard cap 10% in code). A winner always gets their stake back.
- Result is posted by the `resolver` (use a multisig). A 24 hour dispute window follows: one correction or a void is allowed.
- If nobody posts a result within 7 days of closing, **anyone** can void the market and everyone is refunded.
- Nobody can take player stakes. Pausing stops new stakes only, never claims or refunds.
- Launch caps: min 1, max 50 per wallet per market, 5,000 per market (the owner can change them).
- Optional entry permit (EIP-712) signed by your server after ID and country checks (`requirePermit`). Off for the free testnet beta.

## Stable chain facts (from docs.stable.xyz)
| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 988 | 2201 |
| RPC | https://rpc.stable.xyz | https://rpc.testnet.stable.xyz |
| Explorer | https://stablescan.xyz | https://testnet.stablescan.xyz |

- USDT0 is the gas coin (18 decimals) AND an ERC-20 (6 decimals) on the same balance. This contract only uses the ERC-20 side. Mainnet ERC-20 address: `0x779Ded0c9e1022225f8E0630b35a9b54bE713736`. For the testnet address, check docs.stable.xyz or the testnet explorer.
- Faucet: https://faucet.stable.xyz (about 1 test USDT0 per request). Players need a little USDT0 left over for gas.
- Stable behaves differently from Ethereum in four ways (native balance can change through allowances, zero-address transfers revert, EXTCODEHASH, extra Transfer events). The contract and tests are written for these.

## Run the tests without installing anything
Push this repo. GitHub runs `.github/workflows/contracts.yml` and shows pass or fail in the **Actions** tab.
(Your push token needs the **Workflows: read and write** permission, or GitHub refuses the push.)

On a computer with Foundry:
```
cd contracts
git clone --depth 1 --branch v5.0.2 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts
git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
forge build && forge test -vvv
```

## Deploy to the testnet
Use a **new throwaway wallet** for the testnet. Never your main wallet, and never commit a key.
```
export USDT0_ADDRESS=<testnet USDT0 ERC-20 address>
export OWNER=<your address>  RESOLVER=<your address for now>  GUARDIAN=<your address>  FEE_RECIPIENT=<your address>
forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.stable.xyz --broadcast --account <keystore-name>
```
Then verify the contract on the explorer, create a market with `createMarket`, and try it with test coins.

## Before real money (not before)
1. Licence and legal advice. 2. Independent audit. 3. Owner and resolver become multisigs (for example Safe) on hardware wallets. 4. `requirePermit = true` with your server signing after ID checks. 5. Keep the caps tiny at first.

## Known limits of v1
- Trust: the resolver decides the result (see dispute window). Not upgradeable: a fix means a new contract.
- Rounding dust of up to 1 token unit per winner stays in the contract.
- If USDT0's issuer freezes an address, that address cannot claim.
