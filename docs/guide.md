# Morpho Integration

## What is Morpho?

Morpho is a permissionless lending protocol with two layers: **Morpho Blue** (the core lending primitive) and **MetaMorpho vaults** (curated yield products). Morpho Blue is a 650-line immutable smart contract where anyone can create isolated lending markets. MetaMorpho vaults are ERC-4626 contracts that allocate across multiple Blue markets for passive yield.

## Common inputs

| Input       | Description                                                               |
| ----------- | ------------------------------------------------------------------------- |
| `network`   | Blockchain network: `ethereum`, `base`, `arbitrum`, `polygon`, `optimism` |
| `rpc-url`   | Custom RPC URL (recommended for reliability)                              |
| `market-id` | Morpho Blue market ID (bytes32 hash)                                      |

### Market params (for write operations)

Write operations take 5 market params instead of a market ID:

| Input              | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `loan-token`       | Loan token address                                       |
| `collateral-token` | Collateral token address                                 |
| `oracle`           | Oracle contract address                                  |
| `irm`              | Interest rate model address                              |
| `lltv`             | Liquidation LTV in wei (e.g. `860000000000000000` = 86%) |

Use `get-market-params` to look up these values from a market ID.

---

## Blue: Read commands

### `get-market`

Get market state — total supply, borrow, utilization.

| Input       | Required | Description         |
| ----------- | -------- | ------------------- |
| `market-id` | yes      | Market ID (bytes32) |
| `network`   | yes      | Target network      |

**Output:** `{ marketId, network, totalSupplyAssets, totalBorrowAssets, utilization, lastUpdate, fee }`.

### `get-market-params`

Get the 5 market parameters from a market ID.

| Input       | Required | Description         |
| ----------- | -------- | ------------------- |
| `market-id` | yes      | Market ID (bytes32) |
| `network`   | yes      | Target network      |

**Output:** `{ marketId, loanToken, collateralToken, oracle, irm, lltv }`.

### `get-position`

Get a user's position in a specific market.

| Input       | Required | Description    |
| ----------- | -------- | -------------- |
| `market-id` | yes      | Market ID      |
| `user`      | yes      | User address   |
| `network`   | yes      | Target network |

**Output:** `{ marketId, user, supplyShares, borrowShares, collateral }`.

### `list-markets`

List markets from the Morpho GraphQL API, sorted by supply.

| Input     | Required | Description                    |
| --------- | -------- | ------------------------------ |
| `network` | yes      | Target network                 |
| `limit`   | no       | Number of results (default 20) |

**Output:** `{ network, count, markets: [{ marketId, loanAsset, collateralAsset, supplyUsd, borrowUsd, supplyApy, borrowApy, lltv }] }`.

### `get-allowance`

Check ERC20 allowance for Morpho Blue or a vault.

| Input     | Required | Description                       |
| --------- | -------- | --------------------------------- |
| `asset`   | yes      | Token address                     |
| `user`    | yes      | Owner address                     |
| `spender` | no       | Spender (defaults to Morpho Blue) |
| `network` | yes      | Target network                    |

**Output:** `{ token, owner, spender, allowance }`.

---

## Vault: Read commands

### `vault-info`

Get vault metadata — name, symbol, underlying asset, total deposits.

| Input           | Required | Description              |
| --------------- | -------- | ------------------------ |
| `vault-address` | yes      | MetaMorpho vault address |
| `network`       | yes      | Target network           |

**Output:** `{ vaultAddress, name, symbol, asset, totalAssets }`.

### `vault-balance`

Get a user's vault position — shares and equivalent asset value.

| Input           | Required | Description    |
| --------------- | -------- | -------------- |
| `vault-address` | yes      | Vault address  |
| `user`          | yes      | User address   |
| `network`       | yes      | Target network |

**Output:** `{ vaultAddress, user, shares, assets }`.

### `list-vaults`

List MetaMorpho vaults from the Morpho GraphQL API.

| Input     | Required | Description                    |
| --------- | -------- | ------------------------------ |
| `network` | yes      | Target network                 |
| `limit`   | no       | Number of results (default 20) |

**Output:** `{ network, count, vaults: [{ address, name, symbol, asset, totalAssetsUsd, apy }] }`.

---

## Blue: Write commands

All write operations require `W3_SECRET_ETHEREUM` and `bridge-allow: [ethereum/call-contract]`.

### `supply`

Supply loan assets to a market to earn yield.

| Input             | Required | Description          |
| ----------------- | -------- | -------------------- |
| Market params (5) | yes      | See above            |
| `amount`          | yes      | Amount in base units |
| `on-behalf-of`    | yes      | Address to credit    |
| `network`         | yes      | Target network       |

**Prerequisite:** `approve` the loan token for Morpho Blue first.

### `withdraw`

Withdraw supplied loan assets from a market.

| Input             | Required | Description        |
| ----------------- | -------- | ------------------ |
| Market params (5) | yes      | See above          |
| `amount`          | yes      | Amount to withdraw |
| `on-behalf-of`    | yes      | Position owner     |
| `network`         | yes      | Target network     |

### `supply-collateral`

Deposit collateral to enable borrowing.

| Input             | Required | Description       |
| ----------------- | -------- | ----------------- |
| Market params (5) | yes      | See above         |
| `amount`          | yes      | Collateral amount |
| `on-behalf-of`    | yes      | Address to credit |
| `network`         | yes      | Target network    |

**Prerequisite:** `approve` the collateral token for Morpho Blue first.

### `withdraw-collateral`

Withdraw collateral after repaying debt.

| Input             | Required | Description            |
| ----------------- | -------- | ---------------------- |
| Market params (5) | yes      | See above              |
| `amount`          | yes      | Collateral to withdraw |
| `on-behalf-of`    | yes      | Position owner         |
| `network`         | yes      | Target network         |

### `borrow`

Borrow loan assets against supplied collateral.

| Input             | Required | Description      |
| ----------------- | -------- | ---------------- |
| Market params (5) | yes      | See above        |
| `amount`          | yes      | Amount to borrow |
| `on-behalf-of`    | yes      | Borrower address |
| `network`         | yes      | Target network   |

### `repay`

Repay borrowed assets.

| Input             | Required | Description      |
| ----------------- | -------- | ---------------- |
| Market params (5) | yes      | See above        |
| `amount`          | yes      | Amount to repay  |
| `on-behalf-of`    | yes      | Borrower address |
| `network`         | yes      | Target network   |

**Prerequisite:** `approve` the loan token for Morpho Blue first.

### `liquidate`

Liquidate an unhealthy position. The liquidator repays debt and seizes collateral plus a bonus.

| Input             | Required | Description                |
| ----------------- | -------- | -------------------------- |
| Market params (5) | yes      | See above                  |
| `borrower`        | yes      | Address to liquidate       |
| `seized-assets`   | yes      | Collateral amount to seize |
| `network`         | yes      | Target network             |

---

## Protocol commands

### `accrue-interest`

Force interest accrual on a market. Useful before reads for accurate balances.

| Input             | Required | Description    |
| ----------------- | -------- | -------------- |
| Market params (5) | yes      | See above      |
| `network`         | yes      | Target network |

### `create-market`

Create a new Morpho Blue market. Anyone can create markets — no governance needed.

| Input             | Required | Description            |
| ----------------- | -------- | ---------------------- |
| Market params (5) | yes      | Defines the new market |
| `network`         | yes      | Target network         |

### `set-authorization`

Authorize another address to manage your positions.

| Input           | Required | Description                           |
| --------------- | -------- | ------------------------------------- |
| `authorized`    | yes      | Address to authorize                  |
| `is-authorized` | no       | `true` (default) or `false` to revoke |
| `network`       | yes      | Target network                        |

### `approve`

ERC20 approval for Morpho Blue or a vault to spend tokens.

| Input     | Required | Description                       |
| --------- | -------- | --------------------------------- |
| `asset`   | yes      | Token address                     |
| `amount`  | yes      | Amount to approve                 |
| `spender` | no       | Spender (defaults to Morpho Blue) |
| `network` | yes      | Target network                    |

### `wrap-eth`

Convert native ETH to WETH. Required before supplying ETH as collateral.

| Input     | Required | Description    |
| --------- | -------- | -------------- |
| `amount`  | yes      | Amount in wei  |
| `network` | yes      | Target network |

### `unwrap-eth`

Convert WETH back to native ETH.

| Input     | Required | Description    |
| --------- | -------- | -------------- |
| `amount`  | yes      | Amount in wei  |
| `network` | yes      | Target network |

---

## Vault: Write commands

### `vault-deposit`

Deposit assets into a MetaMorpho vault for passive yield.

| Input           | Required | Description               |
| --------------- | -------- | ------------------------- |
| `vault-address` | yes      | Vault contract address    |
| `amount`        | yes      | Assets to deposit         |
| `receiver`      | yes      | Address to receive shares |
| `network`       | yes      | Target network            |

**Prerequisite:** `approve` the underlying asset for the vault address (use `spender` input).

### `vault-withdraw`

Withdraw assets from a vault (asset-denominated).

| Input           | Required | Description                        |
| --------------- | -------- | ---------------------------------- |
| `vault-address` | yes      | Vault contract address             |
| `amount`        | yes      | Assets to withdraw                 |
| `receiver`      | yes      | Address to receive assets          |
| `owner`         | no       | Share owner (defaults to receiver) |
| `network`       | yes      | Target network                     |

### `vault-redeem`

Redeem vault shares for assets (share-denominated withdrawal).

| Input           | Required | Description                        |
| --------------- | -------- | ---------------------------------- |
| `vault-address` | yes      | Vault contract address             |
| `shares`        | yes      | Shares to redeem                   |
| `receiver`      | yes      | Address to receive assets          |
| `owner`         | no       | Share owner (defaults to receiver) |
| `network`       | yes      | Target network                     |

---

## Testing

### Bridge-verified commands (23 of 24)

All commands except `liquidate` (requires unhealthy position) and `create-market` (irreversible) have been verified end-to-end through the W3 bridge on Ethereum mainnet and Base.

### Unit tests

```bash
npm test     # mocked bridge tests
npm run all  # format + lint + test + build
```
