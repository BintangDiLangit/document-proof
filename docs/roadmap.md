# Delivery phases

| Phase             | Scope                                                            | Exit gate                                                                          | State                                          |
| ----------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| 0 — boundaries    | PDF only, no uploads, permission and identity separated          | Document trust model and immutable record rules                                    | Implemented                                    |
| 1 — contract      | Permission, issue/read/revoke, expiry, two-step ownership        | Unauthorized/overwrite tests, fuzz and invariant pass                              | Implemented; local checks pass                 |
| 2 — product       | Responsive verify/issue/activity/issuer/admin, QR and receipt    | Real local-chain happy and negative paths, browser review                          | Implemented; see validation evidence           |
| 3 — hardening     | Input boundaries, transaction recovery, independent CLI, CI      | Automated checks + production build; review security limits                        | Implemented; external audit not performed      |
| 4 — testnet       | Base Sepolia, source verification, published deployment manifest | Funded owner/issuer test wallet, deployed verified contract, browser wallet pilot  | Pending wallet/funding and deployment          |
| 5 — public v0.1   | Public code, demo, docs, contribution guidance                   | CI passing, public demo reachable, release states truthful                         | Public demo release; live testnet gate remains |
| 6 — pilot/mainnet | Real institution pilot, key custody and approval policy          | User evidence, operational owner, independent review and explicit mainnet decision | Deferred                                       |

UI acceptance: wallet-free verification; original match; altered mismatch; revoked/expired independent of match; unsupported receipt denied; RPC errors not marked valid; mobile layout; keyboard focus; reduced-motion support; no PDF upload. Issuance requires an enabled wallet on the configured chain, a final PDF, and explicit transaction confirmation. Demo mode cannot issue real records.

Success measures for a pilot: users correctly understand all three checks, independently verify receipts, recover pending transactions without duplicate issuance, and complete verification without wallet setup. No invented user metrics are included.
