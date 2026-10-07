# Architecture and trust model

## Data flow

PDF bytes → browser WebCrypto SHA-256 → wallet simulation/review → registry transaction. Verification reads the configured registry through an RPC, computes the selected file's hash locally, and compares the two. No document server or database is involved.

Records are keyed by `(issuer address, random 32-byte document ID)`. A record stores SHA-256, issuance timestamp, optional expiry and revocation flag. Duplicate IDs within an issuer cannot overwrite records. A different issuer has a separate namespace. The original issuer can revoke its records even after permission is disabled. Admin approval controls new issuance only, and does not certify identity. Ownership transfer is two-step.

The contract is immutable and not upgradeable. Replacing it requires a new published deployment; old receipts retain their original registry.

## Receipt v1

JSON fields: `version: 1`, `chainId`, `registry`, `issuer`, `documentId`, `sha256Hash`, optional `transactionHash`. Addresses and nonzero 32-byte hashes are validated. Imported receipts must match a trusted published deployment; they cannot choose an arbitrary RPC. The on-chain record is authoritative, not the receipt's hash. The link uses `#/verify/{chainId}/{registry}/{issuer}/{documentId}`. A QR points to this link and never embeds the PDF.

Do not modify a PDF after registration, including inserting its QR: that changes its hash. Share the QR or receipt separately.

## Failure and transaction behavior

Reads pin the record and permission to the same block, using that block's timestamp for expiry. RPC failure is unavailable status, never a successful check. One transaction confirmation is inclusion, not final settlement; reorgs remain possible. Recheck current state before relying on a result.

The UI simulates writes, shows an execution-gas estimate, then asks the wallet to sign. Estimates exclude Base's additional L1 data fee and are not a total-price promise. Submitted transaction hashes persist locally for recovery. Timeout remains pending, prevents another submission, and offers receipt rechecking. Wallet replacements and cancellations are handled. A confirmed revocation cannot be undone.

Activity scans at most 2,001 blocks per page. This needs an indexer if production volume makes RPC pagination impractical. No speculative indexer is included.

## Threats and limits

- A compromised issuer key can issue false records and revoke its own records. Disable new issuance immediately; recover governance and publish incident details. Existing fingerprints are immutable. Key loss cannot be silently repaired by the admin.
- A compromised owner can approve new issuer wallets. Use a secured owner or multisig before real deployments; initial pilot issuance must follow an explicit identity approval policy.
- Malicious frontend/RPC responses can mislead. Inspect verified source, trusted contract address and another RPC; the CLI gives an independent verification path.
- Registry permission is not real-world identity. The sample issuer is fictional. Do not claim accreditation.
- A hash may reveal whether a guessed or known file was registered. Do not register sensitive documents without a separate privacy design.
- Timestamp expiry depends on block time, not a legal deadline or exact wall-clock guarantee.
- Public RPC availability, limits and historical retention can vary. Host continuity does not guarantee blockchain read availability.

PDF checks validate size and a `%PDF-` header, not full PDF safety/content. Never render untrusted PDFs inside the app. No files or names are stored in receipts or sent to analytics. The UI loads Google Fonts; self-host them if network independence is required.
