# Deployment runbook

The committed `apps/web/public/deployments.json` is empty until a confirmed deployment exists. Production builds show a labelled guided demo and exclude local deployment files and the local wallet. This is intentional; the repo's website is not evidence of testnet deployment.

## Base Sepolia gate

Use a dedicated test wallet owned by the operator, obtain test ETH, and choose the initial owner and issuer. Never use the public Anvil mnemonic or ask someone to paste a seed/private key into an issue or chat. Use a wallet/secure keystore signer. The funded signer and owner/issuer approval are required before this phase can run.

1. Run `pnpm check` and local integration.
2. Compile `contracts/src/DocumentRegistry.sol` using the pinned Foundry configuration. Deploy with constructor `initialOwner` through the operator's signer on **chain 84532 only**. No mainnet deployment is authorized by this runbook.
3. Confirm successful deployment receipt and contract address. Verify source on the testnet explorer using the exact compiler/settings. The owner calls `setIssuer(issuer, true)` and waits for inclusion. Review issuer identity outside the contract.
4. Publish the configuration after verification:

```sh
pnpm contracts:build
node scripts/publish-deployment.mjs <registry> <issuer> <deployment-transaction-hash> https://sepolia.base.org
```

The script checks chain ID, successful deployment receipt/address, runtime bytecode match, owner and issuer permission. It never reads a private key or signs. Commit only this public manifest. Imported receipts cannot override it.

5. Perform browser-wallet acceptance: issue a fictional PDF, reject a changed file, revoke, test expiry, disable issuer and confirm existing records remain visible. Test rejection, wrong network, pending/replacement recovery, a second RPC and independent CLI. Record transaction URLs as evidence.
6. Publish a testnet release only after these checks pass. State that it is unaudited and testnet-only.

## Static demo

GitHub Pages serves the Vite output under `/document-proof/`. The workflow sets `VITE_BASE_PATH`, runs checks and publishes only `apps/web/dist`. Hash routing supports receipt links without server rewrites. The public demo uses fictional sample lifecycle states and real local file hashing, with no on-chain claims or writes.

## References

- [OpenZeppelin ownership and two-step transfer](https://docs.openzeppelin.com/contracts/5.x/access-control)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Base transactions and signing](https://docs.base.org/get-started/make-a-transaction)
