/**
 * Morpho Blue unit tests.
 *
 * Covers: amount validation (INVALID_AMOUNT), formatMarketParams validation,
 * unwrapBridgeResult / extractTxHash helpers, write operations (supply, borrow),
 * and read operations (listMarkets, getAllowance, listVaults).
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  getMarket,
  getMarketParams,
  getPosition,
  supply,
  withdraw,
  borrow,
  repay,
  supplyCollateral,
  withdrawCollateral,
  getAllowance,
  listMarkets,
  listVaults,
  MorphoError,
} from '../src/morpho.js'
import { bridge } from '@w3-io/action-core'

let originalChain
let bridgeCalls

beforeEach(() => {
  originalChain = bridge.chain
  bridgeCalls = []
})

afterEach(() => {
  bridge.chain = originalChain
})

function mockBridge(responses) {
  let index = 0
  bridge.chain = async (chainType, operation, params) => {
    bridgeCalls.push({ chainType, operation, params })
    const response = responses[index++]
    if (!response) throw new Error(`Unexpected bridge call ${index}`)
    return response.value
  }
}

// ── Valid market params for write operations ─────────────────

const MARKET_PARAMS = {
  loanToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  collateralToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  oracle: '0x1234567890123456789012345678901234567890',
  irm: '0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC',
  lltv: '860000000000000000',
}

const ON_BEHALF = '0x0000000000000000000000000000000000000042'

// ── Read: getMarket ──────────────────────────────────────────

describe('getMarket', () => {
  it('returns market state from Morpho Blue', async () => {
    mockBridge([
      {
        value: [
          '1000000000000', // totalSupplyAssets
          '900000000000', // totalSupplyShares
          '500000000000', // totalBorrowAssets
          '450000000000', // totalBorrowShares
          '1776000000', // lastUpdate
          '0', // fee
        ],
      },
    ])

    const result = await getMarket('0xabc123', 'ethereum')

    assert.equal(result.marketId, '0xabc123')
    assert.equal(result.totalSupplyAssets, '1000000000000')
    assert.equal(result.totalBorrowAssets, '500000000000')
    assert.equal(result.utilization, '50%')
    assert.equal(bridgeCalls[0].operation, 'read-contract')
    assert.equal(bridgeCalls[0].params.contract, '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb')
  })

  it('throws MISSING_MARKET_ID when marketId is empty', async () => {
    await assert.rejects(
      () => getMarket('', 'ethereum'),
      (err) => err instanceof MorphoError && err.code === 'MISSING_MARKET_ID',
    )
  })

  it('throws UNSUPPORTED_NETWORK for unknown network', async () => {
    await assert.rejects(
      () => getMarket('0xabc', 'solana'),
      (err) => err instanceof MorphoError && err.code === 'UNSUPPORTED_NETWORK',
    )
  })
})

// ── Read: getMarketParams ────────────────────────────────────

describe('getMarketParams', () => {
  it('returns market params from idToMarketParams', async () => {
    mockBridge([
      {
        value: [
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // loanToken (USDC)
          '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // collateralToken (WETH)
          '0x1234567890123456789012345678901234567890', // oracle
          '0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC', // irm
          '860000000000000000', // lltv (86%)
        ],
      },
    ])

    const result = await getMarketParams('0xdef456', 'ethereum')

    assert.equal(result.loanToken, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
    assert.equal(result.lltv, '860000000000000000')
  })
})

// ── Read: getPosition ────────────────────────────────────────

describe('getPosition', () => {
  it('returns user position in a market', async () => {
    mockBridge([
      {
        value: [
          '5000000000000', // supplyShares
          '0', // borrowShares
          '1000000000000000000', // collateral (1 ETH)
        ],
      },
    ])

    const result = await getPosition('0xabc', '0xUser', 'ethereum')

    assert.equal(result.supplyShares, '5000000000000')
    assert.equal(result.borrowShares, '0')
    assert.equal(result.collateral, '1000000000000000000')
    assert.equal(result.user, '0xUser')
  })

  it('throws MISSING_USER when user is empty', async () => {
    await assert.rejects(
      () => getPosition('0xabc', '', 'ethereum'),
      (err) => err instanceof MorphoError && err.code === 'MISSING_USER',
    )
  })
})

// ── Amount validation (INVALID_AMOUNT) ───────────────────────

describe('amount validation', () => {
  const badAmounts = [
    { value: 'abc', label: 'non-numeric string "abc"' },
    { value: '0', label: 'zero "0"' },
    { value: '-1', label: 'negative "-1"' },
    { value: '', label: 'empty string ""' },
  ]

  const writeOps = [
    {
      name: 'supply',
      fn: (amt) => supply(MARKET_PARAMS, { assets: amt, onBehalf: ON_BEHALF, network: 'ethereum' }),
    },
    {
      name: 'withdraw',
      fn: (amt) =>
        withdraw(MARKET_PARAMS, { assets: amt, onBehalf: ON_BEHALF, network: 'ethereum' }),
    },
    {
      name: 'borrow',
      fn: (amt) => borrow(MARKET_PARAMS, { assets: amt, onBehalf: ON_BEHALF, network: 'ethereum' }),
    },
    {
      name: 'repay',
      fn: (amt) => repay(MARKET_PARAMS, { assets: amt, onBehalf: ON_BEHALF, network: 'ethereum' }),
    },
    {
      name: 'supplyCollateral',
      fn: (amt) =>
        supplyCollateral(MARKET_PARAMS, { assets: amt, onBehalf: ON_BEHALF, network: 'ethereum' }),
    },
    {
      name: 'withdrawCollateral',
      fn: (amt) =>
        withdrawCollateral(MARKET_PARAMS, {
          assets: amt,
          onBehalf: ON_BEHALF,
          network: 'ethereum',
        }),
    },
  ]

  for (const op of writeOps) {
    for (const bad of badAmounts) {
      it(`${op.name} rejects ${bad.label}`, async () => {
        await assert.rejects(
          () => op.fn(bad.value),
          (err) => err instanceof MorphoError && err.code === 'INVALID_AMOUNT',
        )
      })
    }
  }
})

// ── formatMarketParams validation ────────────────────────────

describe('formatMarketParams validation', () => {
  const fields = ['loanToken', 'collateralToken', 'oracle', 'irm', 'lltv']

  for (const field of fields) {
    it(`supply throws INVALID_MARKET_PARAMS when ${field} is undefined`, async () => {
      const params = { ...MARKET_PARAMS, [field]: undefined }
      await assert.rejects(
        () => supply(params, { assets: '1000', onBehalf: ON_BEHALF, network: 'ethereum' }),
        (err) => err instanceof MorphoError && err.code === 'INVALID_MARKET_PARAMS',
      )
    })

    it(`supply throws INVALID_MARKET_PARAMS when ${field} is null`, async () => {
      const params = { ...MARKET_PARAMS, [field]: null }
      await assert.rejects(
        () => supply(params, { assets: '1000', onBehalf: ON_BEHALF, network: 'ethereum' }),
        (err) => err instanceof MorphoError && err.code === 'INVALID_MARKET_PARAMS',
      )
    })
  }
})

// ── unwrapBridgeResult ───────────────────────────────────────

describe('unwrapBridgeResult (via getMarket)', () => {
  it('unwraps success result with ok: true', async () => {
    mockBridge([
      {
        value: {
          ok: true,
          result: ['100', '90', '50', '45', '1000', '0'],
        },
      },
    ])

    const result = await getMarket('0xabc', 'ethereum')
    assert.equal(result.totalSupplyAssets, '100')
    assert.equal(result.totalBorrowAssets, '50')
  })

  it('throws on bridge error with ok: false', async () => {
    mockBridge([
      {
        value: {
          ok: false,
          code: 'REVERT',
          error: 'execution reverted',
        },
      },
    ])

    await assert.rejects(
      () => getMarket('0xabc', 'ethereum'),
      (err) => err instanceof MorphoError && err.code === 'REVERT',
    )
  })

  it('passes through raw values without ok field', async () => {
    mockBridge([
      {
        value: ['200', '180', '100', '90', '2000', '5'],
      },
    ])

    const result = await getMarket('0xabc', 'ethereum')
    assert.equal(result.totalSupplyAssets, '200')
  })
})

// ── extractTxHash (via supply) ───────────────────────────────

describe('extractTxHash (via write operations)', () => {
  it('extracts txHash from object with txHash field', async () => {
    mockBridge([{ value: { txHash: '0xdeadbeef' } }])

    const result = await supply(MARKET_PARAMS, {
      assets: '1000',
      onBehalf: ON_BEHALF,
      network: 'ethereum',
    })
    assert.equal(result.txHash, '0xdeadbeef')
  })

  it('extracts tx_hash from snake_case result', async () => {
    mockBridge([{ value: { tx_hash: '0xcafe' } }])

    const result = await supply(MARKET_PARAMS, {
      assets: '1000',
      onBehalf: ON_BEHALF,
      network: 'ethereum',
    })
    assert.equal(result.txHash, '0xcafe')
  })

  it('extracts transactionId from result', async () => {
    mockBridge([{ value: { transactionId: '0xbabe' } }])

    const result = await supply(MARKET_PARAMS, {
      assets: '1000',
      onBehalf: ON_BEHALF,
      network: 'ethereum',
    })
    assert.equal(result.txHash, '0xbabe')
  })

  it('returns raw string when result is a plain string', async () => {
    mockBridge([{ value: '0xraw' }])

    const result = await supply(MARKET_PARAMS, {
      assets: '1000',
      onBehalf: ON_BEHALF,
      network: 'ethereum',
    })
    assert.equal(result.txHash, '0xraw')
  })

  it('parses JSON string to extract txHash', async () => {
    mockBridge([{ value: JSON.stringify({ txHash: '0xjson' }) }])

    const result = await supply(MARKET_PARAMS, {
      assets: '1000',
      onBehalf: ON_BEHALF,
      network: 'ethereum',
    })
    assert.equal(result.txHash, '0xjson')
  })
})

// ── Write: supply ────────────────────────────────────────────

describe('supply', () => {
  it('calls bridge with correct args and returns txHash', async () => {
    mockBridge([{ value: { txHash: '0xsupply123' } }])

    const result = await supply(MARKET_PARAMS, {
      assets: '5000000',
      onBehalf: ON_BEHALF,
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xsupply123')
    assert.equal(result.assets, '5000000')
    assert.equal(result.onBehalf, ON_BEHALF)
    assert.equal(result.network, 'ethereum')

    assert.equal(bridgeCalls.length, 1)
    assert.equal(bridgeCalls[0].operation, 'call-contract')
    assert.equal(bridgeCalls[0].params.contract, '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb')
    assert.equal(bridgeCalls[0].params.method, 'supply')
    assert.equal(bridgeCalls[0].params.args[1], '5000000') // assets
    assert.equal(bridgeCalls[0].params.args[2], '0') // shares
    assert.equal(bridgeCalls[0].params.args[3], ON_BEHALF)
  })
})

// ── Write: borrow ────────────────────────────────────────────

describe('borrow', () => {
  it('calls bridge with correct args and returns txHash', async () => {
    mockBridge([{ value: { txHash: '0xborrow456' } }])

    const result = await borrow(MARKET_PARAMS, {
      assets: '2000000',
      onBehalf: ON_BEHALF,
      receiver: '0xReceiver',
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xborrow456')
    assert.equal(result.assets, '2000000')

    assert.equal(bridgeCalls[0].operation, 'call-contract')
    assert.equal(bridgeCalls[0].params.method, 'borrow')
    assert.equal(bridgeCalls[0].params.args[1], '2000000') // assets
    assert.equal(bridgeCalls[0].params.args[4], '0xReceiver') // receiver
  })

  it('defaults receiver to onBehalf when not provided', async () => {
    mockBridge([{ value: { txHash: '0x1' } }])

    await borrow(MARKET_PARAMS, {
      assets: '100',
      onBehalf: ON_BEHALF,
      network: 'ethereum',
    })

    assert.equal(bridgeCalls[0].params.args[4], ON_BEHALF)
  })
})

// ── Write: withdraw ──────────────────────────────────────────

describe('withdraw', () => {
  it('calls bridge with correct args', async () => {
    mockBridge([{ value: { txHash: '0xwithdraw' } }])

    const result = await withdraw(MARKET_PARAMS, {
      assets: '3000000',
      onBehalf: ON_BEHALF,
      receiver: '0xReceiver',
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xwithdraw')
    assert.equal(bridgeCalls[0].params.method, 'withdraw')
    assert.equal(bridgeCalls[0].params.args[4], '0xReceiver')
  })
})

// ── Write: repay ─────────────────────────────────────────────

describe('repay', () => {
  it('calls bridge with correct args', async () => {
    mockBridge([{ value: { txHash: '0xrepay' } }])

    const result = await repay(MARKET_PARAMS, {
      assets: '1000000',
      onBehalf: ON_BEHALF,
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xrepay')
    assert.equal(bridgeCalls[0].params.method, 'repay')
  })
})

// ── Write: supplyCollateral ──────────────────────────────────

describe('supplyCollateral', () => {
  it('calls bridge with correct args', async () => {
    mockBridge([{ value: { txHash: '0xsc' } }])

    const result = await supplyCollateral(MARKET_PARAMS, {
      assets: '1000000000000000000',
      onBehalf: ON_BEHALF,
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xsc')
    assert.equal(bridgeCalls[0].params.method, 'supplyCollateral')
  })
})

// ── Write: withdrawCollateral ────────────────────────────────

describe('withdrawCollateral', () => {
  it('calls bridge with correct args', async () => {
    mockBridge([{ value: { txHash: '0xwc' } }])

    const result = await withdrawCollateral(MARKET_PARAMS, {
      assets: '500000000000000000',
      onBehalf: ON_BEHALF,
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xwc')
    assert.equal(bridgeCalls[0].params.method, 'withdrawCollateral')
  })
})

// ── Read: getAllowance ───────────────────────────────────────

describe('getAllowance', () => {
  const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const OWNER = '0x0000000000000000000000000000000000000042'

  it('reads allowance from token contract', async () => {
    mockBridge([{ value: '1000000000' }])

    const result = await getAllowance(TOKEN, OWNER, { network: 'ethereum' })

    assert.equal(result.allowance, '1000000000')
    assert.equal(result.token, TOKEN)
    assert.equal(result.owner, OWNER)
    assert.equal(result.spender, '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb') // MORPHO_BLUE default
    assert.equal(bridgeCalls[0].operation, 'read-contract')
    assert.equal(bridgeCalls[0].params.contract, TOKEN)
  })

  it('uses custom spender when provided', async () => {
    const SPENDER = '0x9999999999999999999999999999999999999999'
    mockBridge([{ value: '500' }])

    const result = await getAllowance(TOKEN, OWNER, {
      spender: SPENDER,
      network: 'ethereum',
    })

    assert.equal(result.spender, SPENDER)
    assert.equal(bridgeCalls[0].params.args[1], SPENDER)
  })

  it('throws MISSING_TOKEN when token is empty', async () => {
    await assert.rejects(
      () => getAllowance('', OWNER, { network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_TOKEN',
    )
  })

  it('throws MISSING_USER when owner is empty', async () => {
    await assert.rejects(
      () => getAllowance(TOKEN, '', { network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_USER',
    )
  })
})

// ── Read: listMarkets (mocks global fetch) ───────────────────

describe('listMarkets', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns formatted markets from GraphQL API', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: {
          markets: {
            items: [
              {
                uniqueKey: '0xmarket1',
                loanAsset: { symbol: 'USDC', address: '0x1', decimals: 6 },
                collateralAsset: { symbol: 'WETH', address: '0x2', decimals: 18 },
                state: {
                  supplyAssetsUsd: 1000000,
                  borrowAssetsUsd: 500000,
                  supplyApy: 0.035,
                  borrowApy: 0.05,
                  utilization: 0.5,
                },
                lltv: '860000000000000000',
              },
            ],
          },
        },
      }),
    })

    const result = await listMarkets('ethereum')

    assert.equal(result.network, 'ethereum')
    assert.equal(result.count, 1)
    assert.equal(result.markets[0].marketId, '0xmarket1')
    assert.equal(result.markets[0].loanAsset, 'USDC')
    assert.equal(result.markets[0].collateralAsset, 'WETH')
    assert.equal(result.markets[0].supplyUsd, '$1000000')
    assert.equal(result.markets[0].borrowUsd, '$500000')
    assert.equal(result.markets[0].supplyApy, '3.50%')
    assert.equal(result.markets[0].borrowApy, '5.00%')
  })

  it('returns empty list when API returns no items', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ data: { markets: { items: [] } } }),
    })

    const result = await listMarkets('ethereum')
    assert.equal(result.count, 0)
    assert.deepEqual(result.markets, [])
  })

  it('throws UNSUPPORTED_NETWORK for unknown network', async () => {
    await assert.rejects(
      () => listMarkets('solana'),
      (err) => err instanceof MorphoError && err.code === 'UNSUPPORTED_NETWORK',
    )
  })
})

// ── Read: listVaults (mocks global fetch) ────────────────────

describe('listVaults', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns formatted vaults from GraphQL API', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: {
          vaults: {
            items: [
              {
                address: '0xvault1',
                name: 'Steakhouse USDC',
                symbol: 'steakUSDC',
                asset: { symbol: 'USDC', address: '0x1', decimals: 6 },
                state: {
                  totalAssetsUsd: 50000000,
                  apy: 0.042,
                },
              },
            ],
          },
        },
      }),
    })

    const result = await listVaults('ethereum')

    assert.equal(result.network, 'ethereum')
    assert.equal(result.count, 1)
    assert.equal(result.vaults[0].address, '0xvault1')
    assert.equal(result.vaults[0].name, 'Steakhouse USDC')
    assert.equal(result.vaults[0].asset, 'USDC')
    assert.equal(result.vaults[0].totalAssetsUsd, '$50000000')
    assert.equal(result.vaults[0].apy, '4.20%')
  })

  it('returns empty list when API returns no items', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ data: { vaults: { items: [] } } }),
    })

    const result = await listVaults('base')
    assert.equal(result.count, 0)
    assert.deepEqual(result.vaults, [])
  })

  it('throws UNSUPPORTED_NETWORK for unknown network', async () => {
    await assert.rejects(
      () => listVaults('solana'),
      (err) => err instanceof MorphoError && err.code === 'UNSUPPORTED_NETWORK',
    )
  })
})
