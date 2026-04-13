/**
 * Morpho Blue market read tests.
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getMarket, getMarketParams, getPosition, MorphoError } from '../src/morpho.js'
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
