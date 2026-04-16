# TODO

## Redundant skip

- [ ] `vault-withdraw` — the E2E skips this because it's an
      alternative form of `vault-redeem` (withdraw specifies the
      underlying-token amount; redeem specifies the share amount).
      We exercise the redeem path so functionally both are
      covered, but `vault-withdraw` itself never runs. Either
      add a dedicated test that uses withdraw specifically, or
      remove the command if it's never going to be preferred over
      redeem.

## Potential additions

- [ ] Bundler — Morpho's bundler contract batches multi-step flows
      (supply-collateral + borrow in one transaction). We expose
      individual operations today; the bundler is the production
      path for gas-efficient composite moves.
- [ ] Pre-liquidation / liquidation callbacks — our `liquidate`
      takes the happy path. Adding support for liquidation
      callback contracts (similar to Aave flash-loan receivers)
      would complete the surface.
- [ ] Blue Oracle utilities — Morpho's Chainlink oracle wrapper
      exposes price staleness / trust thresholds via reads. If a
      workflow needs to verify oracle freshness before trusting a
      price for a supply decision, we don't have a way to do that
      today.
- [ ] MetaMorpho curator API — vault curators can update allocation
      caps, queue new markets. Today our action only exercises the
      user side; curator-side commands would complete the story.

## RPC / infrastructure

- [ ] `withdraw` was flagged in earlier notes as needing a paid RPC
      tier. Today the E2E reports `30/30 active steps pass` but
      that's on the current dev setup — verify the commands still
      work on a vanilla public RPC without hitting rate limits. If
      so, the earlier note is stale; if not, document the RPC
      prereq clearly in `docs/guide.md`.

## Docs

- [ ] `docs/guide.md` covers Blue markets and vault operations but
      doesn't walk through "discover → supply → monitor → redeem"
      as a worked end-to-end example. That's the real onboarding
      story for a new workflow author.
