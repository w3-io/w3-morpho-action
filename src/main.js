import * as core from '@actions/core'
import { createCommandRouter, setJsonOutput, handleError } from '@w3-io/action-core'
import {
  getMarket,
  getMarketParams,
  getPosition,
  listMarkets,
  getVaultInfo,
  getVaultBalance,
  approve,
  supply,
  withdraw,
  supplyCollateral,
  borrow,
  repay,
  vaultDeposit,
  vaultWithdraw,
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

  // ── ERC20 Approval ───────────────────────────────────────────────

  approve: async () => {
    const result = await approve(core.getInput('asset', { required: true }), {
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
