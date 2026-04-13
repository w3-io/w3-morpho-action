import * as core from '@actions/core'
import { createCommandRouter, setJsonOutput, handleError } from '@w3-io/action-core'
import {
  getMarket,
  getMarketParams,
  getPosition,
  listMarkets,
  getAllowance,
  getVaultInfo,
  getVaultBalance,
  listVaults,
  approve,
  wrapEth,
  unwrapEth,
  supply,
  withdraw,
  supplyCollateral,
  withdrawCollateral,
  borrow,
  repay,
  liquidate,
  accrueInterest,
  createMarket,
  setAuthorization,
  vaultDeposit,
  vaultWithdraw,
  vaultRedeem,
  MorphoError,
} from './morpho.js'

/**
 * W3 Morpho Action — command dispatch.
 *
 * Blue: Direct market lending (supply, borrow, liquidate)
 * Vault: ERC-4626 passive yield (deposit, withdraw)
 */

function rpcUrl() {
  return core.getInput('rpc-url') || undefined
}

function marketParamsFromInputs() {
  return {
    loanToken: core.getInput('loan-token', { required: true }),
    collateralToken: core.getInput('collateral-token', { required: true }),
    oracle: core.getInput('oracle', { required: true }),
    irm: core.getInput('irm', { required: true }),
    lltv: core.getInput('lltv', { required: true }),
  }
}

const handlers = {
  // ── Blue: Read ──────────────────────────────────────────────────

  'get-market': async () => {
    const result = await getMarket(
      core.getInput('market-id', { required: true }),
      core.getInput('network', { required: true }),
      { rpcUrl: rpcUrl() },
    )
    setJsonOutput('result', result)
  },

  'get-market-params': async () => {
    const result = await getMarketParams(
      core.getInput('market-id', { required: true }),
      core.getInput('network', { required: true }),
      { rpcUrl: rpcUrl() },
    )
    setJsonOutput('result', result)
  },

  'get-position': async () => {
    const result = await getPosition(
      core.getInput('market-id', { required: true }),
      core.getInput('user', { required: true }),
      core.getInput('network', { required: true }),
      { rpcUrl: rpcUrl() },
    )
    setJsonOutput('result', result)
  },

  'list-markets': async () => {
    const result = await listMarkets(core.getInput('network', { required: true }), {
      first: Number(core.getInput('limit')) || 20,
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  'get-allowance': async () => {
    const result = await getAllowance(
      core.getInput('asset', { required: true }),
      core.getInput('user', { required: true }),
      {
        spender: core.getInput('spender') || undefined,
        network: core.getInput('network', { required: true }),
        rpcUrl: rpcUrl(),
      },
    )
    setJsonOutput('result', result)
  },

  // ── Vault: Read ─────────────────────────────────────────────────

  'vault-info': async () => {
    const result = await getVaultInfo(
      core.getInput('vault-address', { required: true }),
      core.getInput('network', { required: true }),
      { rpcUrl: rpcUrl() },
    )
    setJsonOutput('result', result)
  },

  'vault-balance': async () => {
    const result = await getVaultBalance(
      core.getInput('vault-address', { required: true }),
      core.getInput('user', { required: true }),
      core.getInput('network', { required: true }),
      { rpcUrl: rpcUrl() },
    )
    setJsonOutput('result', result)
  },

  'list-vaults': async () => {
    const result = await listVaults(core.getInput('network', { required: true }), {
      first: Number(core.getInput('limit')) || 20,
    })
    setJsonOutput('result', result)
  },

  // ── ERC20 Approval ───────────────────────────────────────────────

  approve: async () => {
    const result = await approve(core.getInput('asset', { required: true }), {
      amount: core.getInput('amount', { required: true }),
      spender: core.getInput('spender') || undefined,
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  'wrap-eth': async () => {
    const result = await wrapEth({
      amount: core.getInput('amount', { required: true }),
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  'unwrap-eth': async () => {
    const result = await unwrapEth({
      amount: core.getInput('amount', { required: true }),
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  // ── Blue: Write ─────────────────────────────────────────────────

  supply: async () => {
    const result = await supply(marketParamsFromInputs(), {
      assets: core.getInput('amount', { required: true }),
      onBehalf: core.getInput('on-behalf-of', { required: true }),
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  withdraw: async () => {
    const result = await withdraw(marketParamsFromInputs(), {
      assets: core.getInput('amount', { required: true }),
      onBehalf: core.getInput('on-behalf-of', { required: true }),
      receiver: core.getInput('receiver') || undefined,
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  'supply-collateral': async () => {
    const result = await supplyCollateral(marketParamsFromInputs(), {
      assets: core.getInput('amount', { required: true }),
      onBehalf: core.getInput('on-behalf-of', { required: true }),
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  'withdraw-collateral': async () => {
    const result = await withdrawCollateral(marketParamsFromInputs(), {
      assets: core.getInput('amount', { required: true }),
      onBehalf: core.getInput('on-behalf-of', { required: true }),
      receiver: core.getInput('receiver') || undefined,
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  borrow: async () => {
    const result = await borrow(marketParamsFromInputs(), {
      assets: core.getInput('amount', { required: true }),
      onBehalf: core.getInput('on-behalf-of', { required: true }),
      receiver: core.getInput('receiver') || undefined,
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  repay: async () => {
    const result = await repay(marketParamsFromInputs(), {
      assets: core.getInput('amount', { required: true }),
      onBehalf: core.getInput('on-behalf-of', { required: true }),
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  liquidate: async () => {
    const result = await liquidate(marketParamsFromInputs(), {
      borrower: core.getInput('borrower', { required: true }),
      seizedAssets: core.getInput('seized-assets', { required: true }),
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  'accrue-interest': async () => {
    const result = await accrueInterest(marketParamsFromInputs(), {
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  'create-market': async () => {
    const result = await createMarket(marketParamsFromInputs(), {
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  'set-authorization': async () => {
    const result = await setAuthorization({
      authorized: core.getInput('authorized', { required: true }),
      isAuthorized: core.getInput('is-authorized') !== 'false',
      network: core.getInput('network', { required: true }),
      rpcUrl: rpcUrl(),
    })
    setJsonOutput('result', result)
  },

  // ── Vault: Write ────────────────────────────────────────────────

  'vault-deposit': async () => {
    const result = await vaultDeposit(
      core.getInput('vault-address', { required: true }),
      {
        assets: core.getInput('amount', { required: true }),
        receiver: core.getInput('receiver', { required: true }),
        network: core.getInput('network', { required: true }),
        rpcUrl: rpcUrl(),
      },
    )
    setJsonOutput('result', result)
  },

  'vault-withdraw': async () => {
    const result = await vaultWithdraw(
      core.getInput('vault-address', { required: true }),
      {
        assets: core.getInput('amount', { required: true }),
        receiver: core.getInput('receiver', { required: true }),
        owner: core.getInput('owner') || undefined,
        network: core.getInput('network', { required: true }),
        rpcUrl: rpcUrl(),
      },
    )
    setJsonOutput('result', result)
  },

  'vault-redeem': async () => {
    const result = await vaultRedeem(
      core.getInput('vault-address', { required: true }),
      {
        shares: core.getInput('shares', { required: true }),
        receiver: core.getInput('receiver', { required: true }),
        owner: core.getInput('owner') || undefined,
        network: core.getInput('network', { required: true }),
        rpcUrl: rpcUrl(),
      },
    )
    setJsonOutput('result', result)
  },
}

const router = createCommandRouter(handlers)

export async function run() {
  try {
    await router()
  } catch (error) {
    if (error instanceof MorphoError) {
      core.setFailed(`Morpho error (${error.code}): ${error.message}`)
    } else {
      handleError(error)
    }
  }
}
