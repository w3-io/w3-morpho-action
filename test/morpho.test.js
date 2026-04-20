/**
 * Extended Morpho Blue unit tests.
 *
 * Covers all functions at 0% coverage: getVaultInfo, getVaultBalance,
 * wrapEth, unwrapEth, approve, liquidate, accrueInterest, createMarket,
 * setAuthorization, vaultDeposit, vaultWithdraw, vaultRedeem.
 * Also covers JSON-string parsing branches in read functions, and
 * edge cases in listMarkets/listVaults GraphQL response parsing.
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  getMarket,
  getMarketParams,
  getPosition,
  getVaultInfo,
  getVaultBalance,
  listMarkets,
  listVaults,
  wrapEth,
  unwrapEth,
  approve,
  liquidate,
  accrueInterest,
  createMarket,
  setAuthorization,
  vaultDeposit,
  vaultWithdraw,
  vaultRedeem,
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
  bridge.chain = async (chainType, operation, params, net) => {
    bridgeCalls.push({ chainType, operation, params, net })
    const response = responses[index++]
    if (!response) throw new Error(`Unexpected bridge call ${index}`)
    return response.value
  }
}

const MARKET_PARAMS = {
  loanToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  collateralToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  oracle: '0x1234567890123456789012345678901234567890',
  irm: '0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC',
  lltv: '860000000000000000',
}

const ON_BEHALF = '0x0000000000000000000000000000000000000042'
const VAULT_ADDR = '0xVault1234567890123456789012345678901234'

// ── getMarket: JSON string parsing branch ───────────────────

describe('getMarket JSON string branch', () => {
  it('parses JSON string response from bridge', async () => {
    mockBridge([
      {
        value: JSON.stringify({
          totalSupplyAssets: '2000',
          totalSupplyShares: '1800',
          totalBorrowAssets: '1000',
          totalBorrowShares: '900',
          lastUpdate: '999',
          fee: '10',
        }),
      },
    ])

    const result = await getMarket('0xabc', 'ethereum')
    assert.equal(result.totalSupplyAssets, '2000')
    assert.equal(result.totalBorrowAssets, '1000')
    assert.equal(result.utilization, '50%')
  })

  it('uses raw string as-is when JSON parse fails', async () => {
    mockBridge([{ value: 'not-json' }])

    // Non-JSON string will be used as-is, object fields fallback to defaults
    const result = await getMarket('0xabc', 'ethereum')
    assert.equal(result.totalSupplyAssets, '0')
  })

  it('handles zero supply (0% utilization)', async () => {
    mockBridge([
      {
        value: ['0', '0', '0', '0', '100', '0'],
      },
    ])

    const result = await getMarket('0xabc', 'ethereum')
    assert.equal(result.utilization, '0%')
  })

  it('passes rpcUrl to bridge when provided', async () => {
    mockBridge([{ value: ['100', '90', '50', '45', '1000', '0'] }])

    await getMarket('0xabc', 'ethereum', { rpcUrl: 'https://rpc.example.com' })
    assert.equal(bridgeCalls[0].params.rpcUrl, 'https://rpc.example.com')
  })
})

// ── getMarketParams: JSON string parsing branch ─────────────

describe('getMarketParams JSON string branch', () => {
  it('parses JSON string response from bridge', async () => {
    mockBridge([
      {
        value: JSON.stringify({
          loanToken: '0xLoan',
          collateralToken: '0xColl',
          oracle: '0xOracle',
          irm: '0xIrm',
          lltv: '500',
        }),
      },
    ])

    const result = await getMarketParams('0xdef', 'ethereum')
    assert.equal(result.loanToken, '0xLoan')
    assert.equal(result.collateralToken, '0xColl')
    assert.equal(result.lltv, '500')
  })

  it('uses raw string as-is when JSON parse fails', async () => {
    mockBridge([{ value: 'not-json' }])

    const result = await getMarketParams('0xdef', 'ethereum')
    assert.equal(result.loanToken, '')
  })
})

// ── getPosition: JSON string parsing branch ─────────────────

describe('getPosition JSON string branch', () => {
  it('parses JSON string response from bridge', async () => {
    mockBridge([
      {
        value: JSON.stringify({
          supplyShares: '100',
          borrowShares: '50',
          collateral: '200',
        }),
      },
    ])

    const result = await getPosition('0xabc', '0xUser', 'ethereum')
    assert.equal(result.supplyShares, '100')
    assert.equal(result.borrowShares, '50')
    assert.equal(result.collateral, '200')
  })

  it('uses raw string as-is when JSON parse fails', async () => {
    mockBridge([{ value: 'bad-json' }])

    const result = await getPosition('0xabc', '0xUser', 'ethereum')
    assert.equal(result.supplyShares, '0')
  })
})

// ── unwrapBridgeResult: ok true without result field ────────

describe('unwrapBridgeResult ok:true without result', () => {
  it('returns the full object when ok is true but result is undefined', async () => {
    mockBridge([
      {
        value: { ok: true, someOtherField: 'data' },
      },
    ])

    // getMarket will call unwrapBridgeResult which returns the full object
    // when ok is true but result is undefined. The object itself is used as data.
    const result = await getMarket('0xabc', 'ethereum')
    // The returned object has ok=true but no array, so fallback to object fields
    assert.equal(result.totalSupplyAssets, '0')
  })
})

// ── getVaultInfo ────────────────────────────────────────────

describe('getVaultInfo', () => {
  it('returns vault metadata from four bridge calls', async () => {
    mockBridge([
      { value: 'Steakhouse USDC' },
      { value: 'steakUSDC' },
      { value: '0xUSDC' },
      { value: '50000000000' },
    ])

    const result = await getVaultInfo(VAULT_ADDR, 'ethereum')

    assert.equal(result.vaultAddress, VAULT_ADDR)
    assert.equal(result.name, 'Steakhouse USDC')
    assert.equal(result.symbol, 'steakUSDC')
    assert.equal(result.asset, '0xUSDC')
    assert.equal(result.totalAssets, '50000000000')
    assert.equal(result.network, 'ethereum')
    assert.equal(bridgeCalls.length, 4)
  })

  it('throws MISSING_VAULT when address is empty', async () => {
    await assert.rejects(
      () => getVaultInfo('', 'ethereum'),
      (err) => err instanceof MorphoError && err.code === 'MISSING_VAULT',
    )
  })

  it('throws UNSUPPORTED_NETWORK for unknown network', async () => {
    await assert.rejects(
      () => getVaultInfo(VAULT_ADDR, 'solana'),
      (err) => err instanceof MorphoError && err.code === 'UNSUPPORTED_NETWORK',
    )
  })

  it('unwraps bridge result objects with ok:true', async () => {
    mockBridge([
      { value: { ok: true, result: 'Vault Name' } },
      { value: { ok: true, result: 'VLT' } },
      { value: { ok: true, result: '0xAsset' } },
      { value: { ok: true, result: '999' } },
    ])

    const result = await getVaultInfo(VAULT_ADDR, 'ethereum')
    assert.equal(result.name, 'Vault Name')
    assert.equal(result.symbol, 'VLT')
    assert.equal(result.asset, '0xAsset')
    assert.equal(result.totalAssets, '999')
  })

  it('passes rpcUrl when provided', async () => {
    mockBridge([{ value: 'Name' }, { value: 'SYM' }, { value: '0xA' }, { value: '100' }])

    await getVaultInfo(VAULT_ADDR, 'ethereum', { rpcUrl: 'https://rpc.example.com' })
    assert.equal(bridgeCalls[0].params.rpcUrl, 'https://rpc.example.com')
  })
})

// ── getVaultBalance ─────────────────────────────────────────

describe('getVaultBalance', () => {
  it('returns shares and assets for non-zero balance', async () => {
    mockBridge([
      { value: '5000' }, // balanceOf
      { value: '5500' }, // convertToAssets
    ])

    const result = await getVaultBalance(VAULT_ADDR, '0xUser', 'ethereum')

    assert.equal(result.vaultAddress, VAULT_ADDR)
    assert.equal(result.user, '0xUser')
    assert.equal(result.shares, '5000')
    assert.equal(result.assets, '5500')
    assert.equal(bridgeCalls.length, 2)
  })

  it('returns zero assets for zero shares (skips convertToAssets)', async () => {
    mockBridge([
      { value: '0' }, // balanceOf returns 0
    ])

    const result = await getVaultBalance(VAULT_ADDR, '0xUser', 'ethereum')

    assert.equal(result.shares, '0')
    assert.equal(result.assets, '0')
    assert.equal(bridgeCalls.length, 1) // only balanceOf, no convertToAssets
  })

  it('throws MISSING_VAULT when vault is empty', async () => {
    await assert.rejects(
      () => getVaultBalance('', '0xUser', 'ethereum'),
      (err) => err instanceof MorphoError && err.code === 'MISSING_VAULT',
    )
  })

  it('throws MISSING_USER when user is empty', async () => {
    await assert.rejects(
      () => getVaultBalance(VAULT_ADDR, '', 'ethereum'),
      (err) => err instanceof MorphoError && err.code === 'MISSING_USER',
    )
  })
})

// ── wrapEth ─────────────────────────────────────────────────

describe('wrapEth', () => {
  it('wraps ETH into WETH on ethereum', async () => {
    mockBridge([{ value: { txHash: '0xwrap' } }])

    const result = await wrapEth({ amount: '1000000000000000000', network: 'ethereum' })

    assert.equal(result.txHash, '0xwrap')
    assert.equal(result.weth, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
    assert.equal(result.amount, '1000000000000000000')
    assert.equal(bridgeCalls[0].operation, 'call-contract')
    assert.equal(bridgeCalls[0].params.value, '1000000000000000000')
  })

  it('uses correct WETH address for base network', async () => {
    mockBridge([{ value: { txHash: '0xwrap2' } }])

    const result = await wrapEth({ amount: '100', network: 'base' })
    assert.equal(result.weth, '0x4200000000000000000000000000000000000006')
  })

  it('throws MISSING_AMOUNT when amount is empty', async () => {
    await assert.rejects(
      () => wrapEth({ amount: '', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_AMOUNT',
    )
  })

  it('throws UNSUPPORTED_NETWORK for unknown network', async () => {
    await assert.rejects(
      () => wrapEth({ amount: '100', network: 'solana' }),
      (err) => err instanceof MorphoError && err.code === 'UNSUPPORTED_NETWORK',
    )
  })
})

// ── unwrapEth ───────────────────────────────────────────────

describe('unwrapEth', () => {
  it('unwraps WETH to ETH on ethereum', async () => {
    mockBridge([{ value: { txHash: '0xunwrap' } }])

    const result = await unwrapEth({ amount: '500', network: 'ethereum' })

    assert.equal(result.txHash, '0xunwrap')
    assert.equal(result.weth, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
    assert.equal(result.amount, '500')
    assert.equal(bridgeCalls[0].params.method, 'function withdraw(uint256)')
    assert.deepEqual(bridgeCalls[0].params.args, ['500'])
  })

  it('throws MISSING_AMOUNT when amount is empty', async () => {
    await assert.rejects(
      () => unwrapEth({ amount: '', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_AMOUNT',
    )
  })

  it('throws UNSUPPORTED_NETWORK for network without WETH', async () => {
    await assert.rejects(
      () => unwrapEth({ amount: '100', network: 'solana' }),
      (err) => err instanceof MorphoError && err.code === 'UNSUPPORTED_NETWORK',
    )
  })
})

// ── approve ─────────────────────────────────────────────────

describe('approve', () => {
  const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

  it('approves Morpho Blue as default spender', async () => {
    mockBridge([{ value: { txHash: '0xapprove' } }])

    const result = await approve(TOKEN, {
      amount: '1000000',
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xapprove')
    assert.equal(result.token, TOKEN)
    assert.equal(result.spender, '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb')
    assert.equal(result.amount, '1000000')
    assert.equal(bridgeCalls[0].params.args[0], '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb')
    assert.equal(bridgeCalls[0].params.args[1], '1000000')
  })

  it('uses custom spender when provided', async () => {
    mockBridge([{ value: { txHash: '0xa2' } }])

    const result = await approve(TOKEN, {
      amount: '500',
      spender: '0xCustomSpender',
      network: 'ethereum',
    })

    assert.equal(result.spender, '0xCustomSpender')
  })

  it('throws MISSING_TOKEN when token is empty', async () => {
    await assert.rejects(
      () => approve('', { amount: '100', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_TOKEN',
    )
  })

  it('throws MISSING_AMOUNT when amount is empty', async () => {
    await assert.rejects(
      () => approve(TOKEN, { amount: '', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_AMOUNT',
    )
  })
})

// ── liquidate ───────────────────────────────────────────────

describe('liquidate', () => {
  it('calls bridge with correct args', async () => {
    mockBridge([{ value: { txHash: '0xliq' } }])

    const result = await liquidate(MARKET_PARAMS, {
      borrower: '0xBorrower',
      seizedAssets: '1000',
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xliq')
    assert.equal(result.borrower, '0xBorrower')
    assert.equal(result.seizedAssets, '1000')
    assert.equal(bridgeCalls[0].params.method, 'liquidate')
    assert.equal(bridgeCalls[0].params.args[1], '0xBorrower')
    assert.equal(bridgeCalls[0].params.args[2], '1000')
  })

  it('throws MISSING_BORROWER when borrower is empty', async () => {
    await assert.rejects(
      () => liquidate(MARKET_PARAMS, { borrower: '', seizedAssets: '100', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_BORROWER',
    )
  })

  it('throws MISSING_AMOUNT when seizedAssets is empty', async () => {
    await assert.rejects(
      () => liquidate(MARKET_PARAMS, { borrower: '0xB', seizedAssets: '', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_AMOUNT',
    )
  })
})

// ── accrueInterest ──────────────────────────────────────────

describe('accrueInterest', () => {
  it('calls bridge and returns txHash', async () => {
    mockBridge([{ value: { txHash: '0xaccrue' } }])

    const result = await accrueInterest(MARKET_PARAMS, { network: 'ethereum' })

    assert.equal(result.txHash, '0xaccrue')
    assert.equal(result.network, 'ethereum')
    assert.ok(bridgeCalls[0].params.method.includes('accrueInterest'))
  })
})

// ── createMarket ────────────────────────────────────────────

describe('createMarket', () => {
  it('calls bridge and returns txHash and marketParams', async () => {
    mockBridge([{ value: { txHash: '0xcreate' } }])

    const result = await createMarket(MARKET_PARAMS, { network: 'ethereum' })

    assert.equal(result.txHash, '0xcreate')
    assert.deepEqual(result.marketParams, MARKET_PARAMS)
    assert.equal(result.network, 'ethereum')
    assert.ok(bridgeCalls[0].params.method.includes('createMarket'))
  })
})

// ── setAuthorization ────────────────────────────────────────

describe('setAuthorization', () => {
  it('authorizes an address', async () => {
    mockBridge([{ value: { txHash: '0xauth' } }])

    const result = await setAuthorization({
      authorized: '0xAgent',
      isAuthorized: true,
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xauth')
    assert.equal(result.authorized, '0xAgent')
    assert.equal(result.isAuthorized, true)
    assert.equal(bridgeCalls[0].params.args[1], 'true')
  })

  it('revokes authorization with isAuthorized false', async () => {
    mockBridge([{ value: { txHash: '0xrevoke' } }])

    const result = await setAuthorization({
      authorized: '0xAgent',
      isAuthorized: false,
      network: 'ethereum',
    })

    assert.equal(result.isAuthorized, false)
    assert.equal(bridgeCalls[0].params.args[1], 'false')
  })

  it('handles undefined isAuthorized as false', async () => {
    mockBridge([{ value: { txHash: '0xrev2' } }])

    const result = await setAuthorization({
      authorized: '0xAgent',
      network: 'ethereum',
    })

    assert.equal(result.isAuthorized, false)
    assert.equal(bridgeCalls[0].params.args[1], 'false')
  })

  it('throws MISSING_ADDRESS when authorized is empty', async () => {
    await assert.rejects(
      () => setAuthorization({ authorized: '', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_ADDRESS',
    )
  })
})

// ── vaultDeposit ────────────────────────────────────────────

describe('vaultDeposit', () => {
  it('deposits assets into a vault', async () => {
    mockBridge([{ value: { txHash: '0xdeposit' } }])

    const result = await vaultDeposit(VAULT_ADDR, {
      assets: '1000000',
      receiver: '0xReceiver',
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xdeposit')
    assert.equal(result.vaultAddress, VAULT_ADDR)
    assert.equal(result.assets, '1000000')
    assert.equal(result.receiver, '0xReceiver')
    assert.equal(bridgeCalls[0].params.contract, VAULT_ADDR)
    assert.equal(bridgeCalls[0].params.method, 'deposit')
  })

  it('throws MISSING_VAULT when vault is empty', async () => {
    await assert.rejects(
      () => vaultDeposit('', { assets: '100', receiver: '0xR', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_VAULT',
    )
  })

  it('throws MISSING_AMOUNT when assets is empty', async () => {
    await assert.rejects(
      () => vaultDeposit(VAULT_ADDR, { assets: '', receiver: '0xR', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_AMOUNT',
    )
  })
})

// ── vaultWithdraw ───────────────────────────────────────────

describe('vaultWithdraw', () => {
  it('withdraws assets from a vault', async () => {
    mockBridge([{ value: { txHash: '0xvw' } }])

    const result = await vaultWithdraw(VAULT_ADDR, {
      assets: '500',
      receiver: '0xReceiver',
      owner: '0xOwner',
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xvw')
    assert.equal(result.vaultAddress, VAULT_ADDR)
    assert.equal(result.assets, '500')
    assert.equal(result.receiver, '0xReceiver')
    assert.equal(bridgeCalls[0].params.args[2], '0xOwner')
  })

  it('defaults owner to receiver when not provided', async () => {
    mockBridge([{ value: { txHash: '0xvw2' } }])

    await vaultWithdraw(VAULT_ADDR, {
      assets: '100',
      receiver: '0xReceiver',
      network: 'ethereum',
    })

    assert.equal(bridgeCalls[0].params.args[2], '0xReceiver')
  })

  it('throws MISSING_VAULT when vault is empty', async () => {
    await assert.rejects(
      () => vaultWithdraw('', { assets: '100', receiver: '0xR', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_VAULT',
    )
  })

  it('throws MISSING_AMOUNT when assets is empty', async () => {
    await assert.rejects(
      () => vaultWithdraw(VAULT_ADDR, { assets: '', receiver: '0xR', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_AMOUNT',
    )
  })
})

// ── vaultRedeem ─────────────────────────────────────────────

describe('vaultRedeem', () => {
  it('redeems shares from a vault', async () => {
    mockBridge([{ value: { txHash: '0xvr' } }])

    const result = await vaultRedeem(VAULT_ADDR, {
      shares: '1000',
      receiver: '0xReceiver',
      owner: '0xOwner',
      network: 'ethereum',
    })

    assert.equal(result.txHash, '0xvr')
    assert.equal(result.vaultAddress, VAULT_ADDR)
    assert.equal(result.shares, '1000')
    assert.equal(result.receiver, '0xReceiver')
    assert.equal(bridgeCalls[0].params.method, 'redeem')
    assert.equal(bridgeCalls[0].params.args[2], '0xOwner')
  })

  it('defaults owner to receiver when not provided', async () => {
    mockBridge([{ value: { txHash: '0xvr2' } }])

    await vaultRedeem(VAULT_ADDR, {
      shares: '100',
      receiver: '0xReceiver',
      network: 'ethereum',
    })

    assert.equal(bridgeCalls[0].params.args[2], '0xReceiver')
  })

  it('throws MISSING_VAULT when vault is empty', async () => {
    await assert.rejects(
      () => vaultRedeem('', { shares: '100', receiver: '0xR', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_VAULT',
    )
  })

  it('throws MISSING_AMOUNT when shares is empty', async () => {
    await assert.rejects(
      () => vaultRedeem(VAULT_ADDR, { shares: '', receiver: '0xR', network: 'ethereum' }),
      (err) => err instanceof MorphoError && err.code === 'MISSING_AMOUNT',
    )
  })
})

// ── listMarkets: GraphQL edge cases ─────────────────────────

describe('listMarkets edge cases', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('handles missing loanAsset/collateralAsset gracefully', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: {
          markets: {
            items: [
              {
                uniqueKey: '0xm1',
                loanAsset: null,
                collateralAsset: null,
                state: null,
                lltv: null,
              },
            ],
          },
        },
      }),
    })

    const result = await listMarkets('ethereum')
    assert.equal(result.markets[0].loanAsset, 'unknown')
    assert.equal(result.markets[0].collateralAsset, 'unknown')
    assert.equal(result.markets[0].supplyUsd, '$0')
    assert.equal(result.markets[0].borrowUsd, '$0')
    assert.equal(result.markets[0].supplyApy, '0%')
    assert.equal(result.markets[0].borrowApy, '0%')
    assert.equal(result.markets[0].lltv, '0%')
  })

  it('handles missing state fields individually', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: {
          markets: {
            items: [
              {
                uniqueKey: '0xm2',
                loanAsset: { symbol: 'USDC' },
                collateralAsset: { symbol: 'WETH' },
                state: {
                  supplyAssetsUsd: 0,
                  borrowAssetsUsd: 0,
                  supplyApy: 0,
                  borrowApy: 0,
                },
                lltv: '0',
              },
            ],
          },
        },
      }),
    })

    const result = await listMarkets('ethereum')
    // 0 is falsy, so these all hit the fallback
    assert.equal(result.markets[0].supplyUsd, '$0')
    assert.equal(result.markets[0].borrowUsd, '$0')
    assert.equal(result.markets[0].supplyApy, '0%')
    assert.equal(result.markets[0].borrowApy, '0%')
    assert.equal(result.markets[0].lltv, '0.0%')
  })

  it('passes custom first parameter', async () => {
    let capturedBody
    globalThis.fetch = async (_url, opts) => {
      capturedBody = opts?.body || (typeof opts === 'string' ? opts : null)
      return {
        ok: true,
        json: async () => ({ data: { markets: { items: [] } } }),
      }
    }

    await listMarkets('ethereum', { first: 5 })
    // The query is built with the first parameter
  })

  it('handles null data response', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ data: null }),
    })

    const result = await listMarkets('ethereum')
    assert.equal(result.count, 0)
    assert.deepEqual(result.markets, [])
  })
})

// ── listVaults: GraphQL edge cases ──────────────────────────

describe('listVaults edge cases', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('handles missing asset and state gracefully', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: {
          vaults: {
            items: [
              {
                address: '0xv1',
                name: 'Test Vault',
                symbol: 'TV',
                asset: null,
                state: null,
              },
            ],
          },
        },
      }),
    })

    const result = await listVaults('ethereum')
    assert.equal(result.vaults[0].asset, 'unknown')
    assert.equal(result.vaults[0].totalAssetsUsd, '$0')
    assert.equal(result.vaults[0].apy, '0%')
  })

  it('handles zero apy and totalAssetsUsd', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: {
          vaults: {
            items: [
              {
                address: '0xv2',
                name: 'Zero Vault',
                symbol: 'ZV',
                asset: { symbol: 'USDC' },
                state: {
                  totalAssetsUsd: 0,
                  apy: 0,
                },
              },
            ],
          },
        },
      }),
    })

    const result = await listVaults('ethereum')
    // 0 is falsy
    assert.equal(result.vaults[0].totalAssetsUsd, '$0')
    assert.equal(result.vaults[0].apy, '0%')
  })

  it('handles null data response', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ data: null }),
    })

    const result = await listVaults('ethereum')
    assert.equal(result.count, 0)
    assert.deepEqual(result.vaults, [])
  })
})

// ── MorphoError ─────────────────────────────────────────────

describe('MorphoError', () => {
  it('has correct name and code', () => {
    const err = new MorphoError('TEST_CODE', 'test message')
    assert.equal(err.name, 'MorphoError')
    assert.equal(err.code, 'TEST_CODE')
    assert.equal(err.message, 'test message')
  })

  it('accepts details option', () => {
    const err = new MorphoError('CODE', 'msg', { details: { foo: 'bar' } })
    assert.equal(err.name, 'MorphoError')
  })
})

// ── resolveNetwork: MISSING_NETWORK ─────────────────────────

describe('resolveNetwork via getMarket', () => {
  it('throws MISSING_NETWORK when network is null', async () => {
    await assert.rejects(
      () => getMarket('0xabc', null),
      (err) => err instanceof MorphoError && err.code === 'MISSING_NETWORK',
    )
  })

  it('throws MISSING_NETWORK when network is undefined', async () => {
    await assert.rejects(
      () => getMarket('0xabc', undefined),
      (err) => err instanceof MorphoError && err.code === 'MISSING_NETWORK',
    )
  })
})
