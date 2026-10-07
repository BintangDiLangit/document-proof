# Validation evidence

Snapshot: 7 October 2026. Network: local Anvil, chain 31337; fictional files only.

## Passed locally

- Ten Foundry checks: permissions, issuer namespace, immutable records, revocation, disabled issuers, expiry boundary, two-step owner transfer, 256 fuzz inputs and 4,096 invariant calls.
- Three Node checks: exact SHA-256 comparisons and invalid PDF/size boundaries; record lifecycle distinct from integrity/permission; receipt/route validation and trusted deployment matching.
- Real EVM integration: issue/read, original match, altered mismatch, disable issuer, original issuer revocation, expiration.
- Independent CLI: active original sample returned match/enabled and exit 0.
- Strict TypeScript and Vite production build pass. Production output excludes the local mnemonic and local deployment manifests.
- Desktop browser: Original → exact match/active; Altered → mismatch/active; Revoked → exact match/revoked; Expired → exact match/expired. All read the local chain.
- Browser issuance: public development account selected explicitly, fictional PDF chosen, transaction reviewed and published; successful receipt and QR/verification link displayed. Registry `0x0dcd1bf9a1b36ce34237eeafef220932846bcd82`, document ID `0xf35e1de7cc78b0aead483d3df09f910153740326832e6c69bdd2550f8ea7d562`. The local chain is disposable.

## Remaining gates

- Responsive browser review was interrupted by an open browser-extension UI; mobile acceptance is not claimed. CSS breakpoints and reduced-motion support exist.
- Browser wallet extension, rejection/replacement, persisted pending recovery and browser revocation need final acceptance; implementation and contract/integration checks do not replace those checks.
- GitHub Actions jobs did not start. GitHub's check annotation reports: account locked due to a billing issue. Therefore remote CI and Pages publication are not verified, even though local checks passed. Resolve the account issue and rerun both workflows.
- No Base Sepolia contract deployment, funded operator wallet, public explorer source verification or mainnet release exists. Follow the deployment runbook after wallet/funding is available.
- No independent contract audit, real issuer identity approval or user pilot performed.
