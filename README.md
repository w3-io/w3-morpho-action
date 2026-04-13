# W3 Morpho Action

Morpho Blue lending and MetaMorpho vaults for W3 workflows. 24 commands across direct market lending, vault yield, and protocol management on Ethereum, Base, Arbitrum, Polygon, and Optimism.

## Quick start

```yaml
# Read: list top markets on Ethereum
- uses: w3-io/w3-morpho-action@v0
  with:
    command: list-markets
    network: ethereum

# Read: get vault info
- uses: w3-io/w3-morpho-action@v0
  id: vault
  with:
    command: vault-info
    vault-address: '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB'
    network: ethereum

# Write: supply USDC to a market on Base
- uses: w3-io/w3-morpho-action@v0
  env:
    W3_SECRET_ETHEREUM: ${{ secrets.W3_SECRET_ETHEREUM }}
  bridge-allow: [ethereum/call-contract]
  with:
    command: supply
    network: base
    loan-token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    collateral-token: '0x4200000000000000000000000000000000000006'
    oracle: '0xFEa2D58cEfCb9fcb597723c6bAE66fFE4193aFE4'
    irm: '0x46415998764C29aB2a25CbeA6254146D50D22687'
    lltv: '860000000000000000'
    amount: '1000000'
    on-behalf-of: '0xYourAddress'
```

## Commands

24 commands across 5 categories:

| Category     | Commands                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Blue reads   | `get-market`, `get-market-params`, `get-position`, `list-markets`, `get-allowance`               |
| Vault reads  | `vault-info`, `vault-balance`, `list-vaults`                                                     |
| Blue writes  | `supply`, `withdraw`, `supply-collateral`, `withdraw-collateral`, `borrow`, `repay`, `liquidate` |
| Vault writes | `vault-deposit`, `vault-withdraw`, `vault-redeem`                                                |
| Protocol     | `accrue-interest`, `create-market`, `set-authorization`, `approve`, `wrap-eth`, `unwrap-eth`     |

See [docs/guide.md](docs/guide.md) for per-command reference.

## Networks

Ethereum, Base, Arbitrum, Polygon, Optimism.

Morpho Blue uses the same contract address on all chains: `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` (CREATE2 deterministic deployment).

## Architecture

All on-chain operations go through the W3 bridge. No private keys in the action container.

- **Blue reads**: `bridge.chain('ethereum', 'read-contract', ...)` with full ABI JSON for tuple decoding
- **Blue writes**: `bridge.chain('ethereum', 'call-contract', ...)` with signer from `W3_SECRET_ETHEREUM`
- **Market discovery**: Morpho GraphQL API (`blue-api.morpho.org/graphql`)
- **Vault operations**: Standard ERC-4626 interface

Markets are identified by a `bytes32` ID (keccak256 of MarketParams). Write operations take the 5 market params directly (loan token, collateral token, oracle, IRM, LLTV).

## Development

```bash
npm ci
npm run all    # format, lint, test, build
```
