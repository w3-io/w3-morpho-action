# E2E Test Results

> Last verified: 2026-04-15

## Prerequisites

| Credential           | Env var              | Source            |
| -------------------- | -------------------- | ----------------- |
| Ethereum private key | `W3_SECRET_ETHEREUM` | Bridge signer     |
| Alchemy Base RPC URL | `ALCHEMY_BASE_RPC`   | Alchemy dashboard |

### On-chain requirements

Funded EVM wallet on Base with ETH + USDC.

## Results

| #   | Step                    | Command               | Status | Notes                                     |
| --- | ----------------------- | --------------------- | ------ | ----------------------------------------- |
| 1   | Get market              | `get-market`          | PASS   | USDC/WETH 86% LLTV                        |
| 2   | Get market params       | `get-market-params`   | PASS   |                                           |
| 3   | List markets            | `list-markets`        | PASS   |                                           |
| 4   | Get position            | `get-position`        | PASS   |                                           |
| 5   | Get allowance           | `get-allowance`       | PASS   |                                           |
| 6   | List vaults             | `list-vaults`         | PASS   |                                           |
| 7   | Vault info              | `vault-info`          | PASS   | Steakhouse Prime                          |
| 8   | Vault balance           | `vault-balance`       | PASS   |                                           |
| 9   | Print read results      | (run step)            | PASS   |                                           |
| 10  | Wrap ETH (helpers)      | `wrap-eth`            | PASS   |                                           |
| 11  | Unwrap ETH (helpers)    | `unwrap-eth`          | PASS   |                                           |
| 12  | Print helper results    | (run step)            | PASS   |                                           |
| 13  | Wrap ETH (lifecycle)    | `wrap-eth`            | PASS   |                                           |
| 14  | Approve WETH            | `approve`             | PASS   |                                           |
| 15  | Supply collateral       | `supply-collateral`   | PASS   |                                           |
| 16  | Borrow USDC             | `borrow`              | PASS   |                                           |
| 17  | Approve USDC for repay  | `approve`             | PASS   |                                           |
| 18  | Repay USDC              | `repay`               | PASS   | Recovery                                  |
| 19  | Withdraw collateral     | `withdraw-collateral` | PASS   | Recovery                                  |
| 20  | Accrue interest         | `accrue-interest`     | PASS   |                                           |
| 21  | Unwrap ETH (recovery)   | `unwrap-eth`          | PASS   | Recovery                                  |
| 22  | Print lifecycle results | (run step)            | PASS   |                                           |
| 23  | Approve USDC for vault  | `approve`             | PASS   |                                           |
| 24  | Vault deposit           | `vault-deposit`       | PASS   |                                           |
| 25  | Vault balance check     | `vault-balance`       | PASS   |                                           |
| 26  | Vault redeem            | `vault-redeem`        | PASS   | Recovery                                  |
| 27  | Print vault results     | (run step)            | PASS   |                                           |
| 28  | Approve USDC (supply)   | `approve`             | PASS   |                                           |
| 29  | Supply USDC to market   | `supply`              | PASS   |                                           |
| 30  | Withdraw USDC           | `withdraw`            | SKIP   | Requires premium RPC to avoid rate limits |
| 31  | Print supply results    | (run step)            | PASS   |                                           |

**Summary: 30/30 active steps pass (1 skipped).**

## Skipped Commands

| Command          | Reason                                         |
| ---------------- | ---------------------------------------------- |
| `vault-withdraw` | Alternative to redeem; tested via vault-redeem |

## How to run

```bash
# Export credentials
export W3_SECRET_ETHEREUM="..."
export ALCHEMY_BASE_RPC="..."

# Start bridge (on-chain)
w3 bridge serve --port 8232 --signer-ethereum "$W3_SECRET_ETHEREUM" --allow "*" &
export W3_BRIDGE_URL="http://host.docker.internal:8232"

# Run
w3 workflow test --execute test/workflows/e2e.yaml
```
