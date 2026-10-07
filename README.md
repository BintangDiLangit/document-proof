# Document Proof

An open-source PDF integrity registry. Issue a fingerprint on-chain, share a receipt or QR, and compare the exact file without connecting a wallet or uploading the PDF.

**Prototype:** local blockchain flows are implemented and tested. The public website is a clearly labelled guided demo until a Base Sepolia deployment is published. No mainnet deployment, external security audit, or accreditation claim.

## Run locally

Requirements: Node.js 24 and pnpm 10.30.3. Foundry binaries install from the official `@foundry-rs` npm packages.

```sh
pnpm install --frozen-lockfile
pnpm chain                   # leave running in terminal 1
pnpm seed                    # terminal 2: deploy + fictional samples
pnpm dev                     # http://localhost:4173
```

Open **Original**, **Altered**, **Revoked**, or **Expired**. Local mode reads real Anvil records. Under Issue, use the explicitly labelled local test account to register a fictional PDF. The development mnemonic is public and must never hold real funds. Restarting Anvil clears its state; rerun `pnpm seed` and reload the browser.

```sh
pnpm check                   # contracts, fuzz/invariant, file/receipt checks, TS, production build
pnpm test:integration        # requires pnpm chain; exercises real writes and reads
pnpm verify .local/deployment.json .local/original.receipt.json apps/web/public/samples/original.pdf
```

## What a result means

Three separate checks: **file match**, **record status**, and **issuer permission**. A matching active record proves that these exact bytes match a fingerprint registered by that wallet. It does not establish the truth of the contents, ownership, accreditation, or the real identity of a wallet. A link alone does not compare the PDF.

Files stay on the device. Fingerprints, issuer addresses, IDs and timestamps are public. Hashes are not encryption and may identify a known document. Use fictional/non-sensitive documents during development.

[Validation evidence and remaining gates](docs/validation.md). GitHub Actions / Pages publication is currently blocked by an account billing lock; the local app is available at http://localhost:4173.

## Repository

- `contracts/`: immutable, issuer-scoped Solidity registry and tests
- `apps/web/`: React/TypeScript UI, local SHA-256, wallet writes, wallet-free reads
- `scripts/`: local deployment, independent verifier, integration checks
- [Architecture and trust model](docs/architecture.md)
- [Phases and acceptance gates](docs/roadmap.md)
- [Testnet deployment runbook](docs/deployment.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

MIT licensed. Built as a personal portfolio and learning project, independent of AIRA.
