/**
 * Morpho Blue on-chain client.
 *
 * Morpho Blue is a singleton lending protocol — one immutable contract
 * per chain, all markets live inside it. Markets are identified by a
 * bytes32 ID computed as keccak256(abi.encode(MarketParams)).
 *
 * MetaMorpho vaults are separate ERC-4626 contracts that allocate
 * across Blue markets. Users interact with vaults for passive yield.
 *
 * All on-chain operations go through the W3 bridge:
 *   - Reads: bridge.chain('ethereum', 'read-contract', ...)
 *   - Writes: bridge.chain('ethereum', 'call-contract', ...)
 */

import { W3ActionError, bridge, request } from '@w3-io/action-core'
import { MORPHO_BLUE, MORPHO_ABI, VAULT_ABI, NETWORKS, MORPHO_API_URL } from './registry.js'

export class MorphoError extends W3ActionError {
  constructor(code, message, { details } = {}) {
    super(code, message, { details })
    this.name = 'MorphoError'
  }
}

// ── Network resolution ────────────────────────────────────────────

function resolveNetwork(network, rpcUrl) {
  if (!network) throw new MorphoError('MISSING_NETWORK', 'network is required')
  const config = NETWORKS[network.toLowerCase()]
  if (!config) {
    throw new MorphoError(
      'UNSUPPORTED_NETWORK',
      `Network "${network}" not supported. Available: ${Object.keys(NETWORKS).join(', ')}`,
    )
  }
  return {
    network: config.bridgeNetwork,
    params: rpcUrl ? { rpcUrl } : {},
  }
}

// ── Bridge helpers ────────────────────────────────────────────────

function unwrapBridgeResult(result) {
  if (result && typeof result === 'object' && 'ok' in result) {
    if (!result.ok) {
      throw new MorphoError(result.code || 'BRIDGE_ERROR', result.error || 'Bridge call failed')
    }
    if (result.result !== undefined) return result.result
    return result
  }
  return result
}

function extractTxHash(receipt) {
  let rx = receipt
  if (typeof rx === 'string') {
    try {
      rx = JSON.parse(rx)
    } catch {
      return rx
    }
  }
  return rx?.txHash || rx?.tx_hash || rx?.transactionId || String(receipt)
}

// ── Read: Market data ─────────────────────────────────────────────

/**
 * Get market state by ID — total supply, borrow, utilization.
 */
export async function getMarket(marketId, network, { rpcUrl } = {}) {
  if (!marketId) throw new MorphoError('MISSING_MARKET_ID', 'market-id is required')

  const net = resolveNetwork(network, rpcUrl)

  const raw = unwrapBridgeResult(
    await bridge.chain('ethereum', 'read-contract', {
      contract: MORPHO_BLUE,
      method: 'market',
      abi: MORPHO_ABI,
      args: [marketId],
      ...net.params,
    }, net.network),
  )

  let data = raw
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { /* use as-is */ }
  }

  const totalSupplyAssets = String(Array.isArray(data) ? data[0] : data?.totalSupplyAssets || '0')
  const totalSupplyShares = String(Array.isArray(data) ? data[1] : data?.totalSupplyShares || '0')
  const totalBorrowAssets = String(Array.isArray(data) ? data[2] : data?.totalBorrowAssets || '0')
  const totalBorrowShares = String(Array.isArray(data) ? data[3] : data?.totalBorrowShares || '0')
  const lastUpdate = String(Array.isArray(data) ? data[4] : data?.lastUpdate || '0')
  const fee = String(Array.isArray(data) ? data[5] : data?.fee || '0')

  // Compute utilization rate
  const supplyBig = BigInt(totalSupplyAssets)
  const borrowBig = BigInt(totalBorrowAssets)
  const utilization = supplyBig > 0n ? Number((borrowBig * 10000n) / supplyBig) / 100 : 0

  return {
    marketId,
    network,
    totalSupplyAssets,
    totalSupplyShares,
    totalBorrowAssets,
    totalBorrowShares,
    utilization: `${utilization}%`,
    lastUpdate,
    fee,
  }
}

/**
 * Get market params (loan token, collateral, oracle, IRM, LLTV) by ID.
 */
export async function getMarketParams(marketId, network, { rpcUrl } = {}) {
  if (!marketId) throw new MorphoError('MISSING_MARKET_ID', 'market-id is required')

  const net = resolveNetwork(network, rpcUrl)

  const raw = unwrapBridgeResult(
    await bridge.chain('ethereum', 'read-contract', {
      contract: MORPHO_BLUE,
      method: 'idToMarketParams',
      abi: MORPHO_ABI,
      args: [marketId],
      ...net.params,
    }, net.network),
  )

  let data = raw
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { /* use as-is */ }
  }

  return {
    marketId,
    network,
    loanToken: String(Array.isArray(data) ? data[0] : data?.loanToken || ''),
    collateralToken: String(Array.isArray(data) ? data[1] : data?.collateralToken || ''),
    oracle: String(Array.isArray(data) ? data[2] : data?.oracle || ''),
    irm: String(Array.isArray(data) ? data[3] : data?.irm || ''),
    lltv: String(Array.isArray(data) ? data[4] : data?.lltv || '0'),
  }
}

/**
 * Get a user's position in a market.
 */
export async function getPosition(marketId, user, network, { rpcUrl } = {}) {
  if (!marketId) throw new MorphoError('MISSING_MARKET_ID', 'market-id is required')
  if (!user) throw new MorphoError('MISSING_USER', 'user address is required')

  const net = resolveNetwork(network, rpcUrl)

  const raw = unwrapBridgeResult(
    await bridge.chain('ethereum', 'read-contract', {
      contract: MORPHO_BLUE,
      method: 'position',
      abi: MORPHO_ABI,
      args: [marketId, user],
      ...net.params,
    }, net.network),
  )

  let data = raw
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { /* use as-is */ }
  }

  return {
    marketId,
    user,
    network,
    supplyShares: String(Array.isArray(data) ? data[0] : data?.supplyShares || '0'),
    borrowShares: String(Array.isArray(data) ? data[1] : data?.borrowShares || '0'),
    collateral: String(Array.isArray(data) ? data[2] : data?.collateral || '0'),
  }
}

/**
 * List markets from the Morpho Blue GraphQL API.
 */
export async function listMarkets(network, { first = 20, rpcUrl } = {}) {
  const config = NETWORKS[network?.toLowerCase()]
  if (!config) {
    throw new MorphoError(
      'UNSUPPORTED_NETWORK',
      `Network "${network}" not supported. Available: ${Object.keys(NETWORKS).join(', ')}`,
    )
  }

  const query = `{
    markets(first: ${first}, where: { chainId_in: [${config.chainId}] }, orderBy: SupplyAssetsUsd, orderDirection: Desc) {
      items {
        uniqueKey
        loanAsset { symbol address decimals }
        collateralAsset { symbol address decimals }
        state {
          supplyAssetsUsd
          borrowAssetsUsd
          supplyApy
          borrowApy
          utilization
        }
        lltv
      }
    }
  }`

  const json = await request(MORPHO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const items = json?.data?.markets?.items || []

  return {
    network,
    count: items.length,
    markets: items.map((m) => ({
      marketId: m.uniqueKey,
      loanAsset: m.loanAsset?.symbol || 'unknown',
      collateralAsset: m.collateralAsset?.symbol || 'unknown',
      supplyUsd: m.state?.supplyAssetsUsd ? `$${Number(m.state.supplyAssetsUsd).toFixed(0)}` : '$0',
      borrowUsd: m.state?.borrowAssetsUsd ? `$${Number(m.state.borrowAssetsUsd).toFixed(0)}` : '$0',
      supplyApy: m.state?.supplyApy ? `${(Number(m.state.supplyApy) * 100).toFixed(2)}%` : '0%',
      borrowApy: m.state?.borrowApy ? `${(Number(m.state.borrowApy) * 100).toFixed(2)}%` : '0%',
      lltv: m.lltv ? `${(Number(m.lltv) / 1e16).toFixed(0)}%` : '0%',
    })),
  }
}

// ── Read: Vault operations ────────────────────────────────────────

/**
 * Get vault metadata — name, symbol, asset, total assets.
 */
export async function getVaultInfo(vaultAddress, network, { rpcUrl } = {}) {
  if (!vaultAddress) throw new MorphoError('MISSING_VAULT', 'vault-address is required')

  const net = resolveNetwork(network, rpcUrl)

  const [name, symbol, asset, totalAssets] = await Promise.all([
    bridge.chain('ethereum', 'read-contract', {
      contract: vaultAddress,
      method: 'name',
      abi: VAULT_ABI,
      args: [],
      ...net.params,
    }, net.network).then(unwrapBridgeResult),
    bridge.chain('ethereum', 'read-contract', {
      contract: vaultAddress,
      method: 'symbol',
      abi: VAULT_ABI,
      args: [],
      ...net.params,
    }, net.network).then(unwrapBridgeResult),
    bridge.chain('ethereum', 'read-contract', {
      contract: vaultAddress,
      method: 'asset',
      abi: VAULT_ABI,
      args: [],
      ...net.params,
    }, net.network).then(unwrapBridgeResult),
    bridge.chain('ethereum', 'read-contract', {
      contract: vaultAddress,
      method: 'totalAssets',
      abi: VAULT_ABI,
      args: [],
      ...net.params,
    }, net.network).then(unwrapBridgeResult),
  ])

  return {
    vaultAddress,
    network,
    name: String(name),
    symbol: String(symbol),
    asset: String(asset),
    totalAssets: String(totalAssets),
  }
}

/**
 * Get a user's vault balance — shares held + equivalent asset value.
 */
export async function getVaultBalance(vaultAddress, user, network, { rpcUrl } = {}) {
  if (!vaultAddress) throw new MorphoError('MISSING_VAULT', 'vault-address is required')
  if (!user) throw new MorphoError('MISSING_USER', 'user address is required')

  const net = resolveNetwork(network, rpcUrl)

  const shares = unwrapBridgeResult(
    await bridge.chain('ethereum', 'read-contract', {
      contract: vaultAddress,
      method: 'balanceOf',
      abi: VAULT_ABI,
      args: [user],
      ...net.params,
    }, net.network),
  )

  const sharesStr = String(shares)
  let assetsStr = '0'

  if (BigInt(sharesStr) > 0n) {
    const assets = unwrapBridgeResult(
      await bridge.chain('ethereum', 'read-contract', {
        contract: vaultAddress,
        method: 'convertToAssets',
        abi: VAULT_ABI,
        args: [sharesStr],
        ...net.params,
      }, net.network),
    )
    assetsStr = String(assets)
  }

  return {
    vaultAddress,
    user,
    network,
    shares: sharesStr,
    assets: assetsStr,
  }
}

// ── Write: Blue market operations ─────────────────────────────────

/**
 * Build MarketParams tuple string for bridge coerce_str.
 */
function formatMarketParams(params) {
  return `(${params.loanToken}, ${params.collateralToken}, ${params.oracle}, ${params.irm}, ${params.lltv})`
}

/**
 * Supply assets to a Morpho Blue market.
 */
export async function supply(marketParams, { assets, onBehalf, network, rpcUrl }) {
  const net = resolveNetwork(network, rpcUrl)

  const receipt = await bridge.chain('ethereum', 'call-contract', {
    contract: MORPHO_BLUE,
    method: 'supply',
    abi: MORPHO_ABI,
    args: [formatMarketParams(marketParams), assets, '0', onBehalf, '0x'],
    ...net.params,
  }, net.network)

  return {
    txHash: extractTxHash(receipt),
    assets,
    onBehalf,
    network,
  }
}

/**
 * Withdraw supplied assets from a Morpho Blue market.
 */
export async function withdraw(marketParams, { assets, onBehalf, receiver, network, rpcUrl }) {
  const net = resolveNetwork(network, rpcUrl)

  const receipt = await bridge.chain('ethereum', 'call-contract', {
    contract: MORPHO_BLUE,
    method: 'withdraw',
    abi: MORPHO_ABI,
    args: [formatMarketParams(marketParams), assets, '0', onBehalf, receiver || onBehalf],
    ...net.params,
  }, net.network)

  return {
    txHash: extractTxHash(receipt),
    assets,
    onBehalf,
    network,
  }
}

/**
 * Supply collateral to a Morpho Blue market.
 */
export async function supplyCollateral(marketParams, { assets, onBehalf, network, rpcUrl }) {
  const net = resolveNetwork(network, rpcUrl)

  const receipt = await bridge.chain('ethereum', 'call-contract', {
    contract: MORPHO_BLUE,
    method: 'supplyCollateral',
    abi: MORPHO_ABI,
    args: [formatMarketParams(marketParams), assets, onBehalf, '0x'],
    ...net.params,
  }, net.network)

  return {
    txHash: extractTxHash(receipt),
    assets,
    onBehalf,
    network,
  }
}

/**
 * Borrow assets from a Morpho Blue market.
 */
export async function borrow(marketParams, { assets, onBehalf, receiver, network, rpcUrl }) {
  const net = resolveNetwork(network, rpcUrl)

  const receipt = await bridge.chain('ethereum', 'call-contract', {
    contract: MORPHO_BLUE,
    method: 'borrow',
    abi: MORPHO_ABI,
    args: [formatMarketParams(marketParams), assets, '0', onBehalf, receiver || onBehalf],
    ...net.params,
  }, net.network)

  return {
    txHash: extractTxHash(receipt),
    assets,
    onBehalf,
    network,
  }
}

/**
 * Repay borrowed assets on a Morpho Blue market.
 */
export async function repay(marketParams, { assets, onBehalf, network, rpcUrl }) {
  const net = resolveNetwork(network, rpcUrl)

  const receipt = await bridge.chain('ethereum', 'call-contract', {
    contract: MORPHO_BLUE,
    method: 'repay',
    abi: MORPHO_ABI,
    args: [formatMarketParams(marketParams), assets, '0', onBehalf, '0x'],
    ...net.params,
  }, net.network)

  return {
    txHash: extractTxHash(receipt),
    assets,
    onBehalf,
    network,
  }
}

// ── Write: Vault operations ───────────────────────────────────────

/**
 * Deposit assets into a MetaMorpho vault.
 */
export async function vaultDeposit(vaultAddress, { assets, receiver, network, rpcUrl }) {
  if (!vaultAddress) throw new MorphoError('MISSING_VAULT', 'vault-address is required')
  if (!assets) throw new MorphoError('MISSING_AMOUNT', 'assets amount is required')

  const net = resolveNetwork(network, rpcUrl)

  const receipt = await bridge.chain('ethereum', 'call-contract', {
    contract: vaultAddress,
    method: 'deposit',
    abi: VAULT_ABI,
    args: [assets, receiver],
    ...net.params,
  }, net.network)

  return {
    txHash: extractTxHash(receipt),
    vaultAddress,
    assets,
    receiver,
    network,
  }
}

/**
 * Withdraw assets from a MetaMorpho vault.
 */
export async function vaultWithdraw(vaultAddress, { assets, receiver, owner, network, rpcUrl }) {
  if (!vaultAddress) throw new MorphoError('MISSING_VAULT', 'vault-address is required')
  if (!assets) throw new MorphoError('MISSING_AMOUNT', 'assets amount is required')

  const net = resolveNetwork(network, rpcUrl)

  const receipt = await bridge.chain('ethereum', 'call-contract', {
    contract: vaultAddress,
    method: 'withdraw',
    abi: VAULT_ABI,
    args: [assets, receiver, owner || receiver],
    ...net.params,
  }, net.network)

  return {
    txHash: extractTxHash(receipt),
    vaultAddress,
    assets,
    receiver,
    network,
  }
}
