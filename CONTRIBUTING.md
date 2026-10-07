# Contributing

Use Node 24 and pnpm 10.30.3. Follow the README local setup and run `pnpm check` plus `pnpm test:integration` with Anvil running. Keep changes scoped and add a regression check for changed security or verification behavior.

Good first contributions: keyboard/mobile UX, clearer negative-state copy, verifier examples, and input-boundary tests. Discuss contract storage changes and new trust assumptions in an issue first. Use fictional fixtures only; never include private keys, customer PDFs, identities or production configuration.

PRs should explain the concrete problem, resulting behavior, checks run, and remaining limits. No token/NFT, payment, proxy, backend or indexer is required for this MVP.
