// Publish only a confirmed, inspected Base Sepolia registry. Does not sign transactions.
import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { isAddress, isHash } from "../apps/web/src/proof.ts";
const [registry, issuer, tx, rpcUrl = "https://sepolia.base.org"] =
  process.argv.slice(2);
if (!isAddress(registry) || !isAddress(issuer) || !isHash(tx))
  throw new Error(
    "Usage: node scripts/publish-deployment.mjs <registry> <issuer> <deployment tx hash> [RPC]",
  );
const url = new URL(rpcUrl);
if (url.protocol !== "https:")
  throw new Error("Public testnet RPC must use HTTPS.");
const c = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
if ((await c.getChainId()) !== 84532)
  throw new Error("Only Base Sepolia is supported.");
const receipt = await c.getTransactionReceipt({ hash: tx });
if (
  receipt.status !== "success" ||
  receipt.contractAddress?.toLowerCase() !== registry.toLowerCase()
)
  throw new Error(
    "Transaction is not the successful deployment of this registry.",
  );
const artifact = JSON.parse(
  await readFile(
    new URL(
      "../contracts/out/DocumentRegistry.sol/DocumentRegistry.json",
      import.meta.url,
    ),
  ),
);
const [code, enabled, owner] = await Promise.all([
  c.getCode({ address: registry }),
  c.readContract({
    address: registry,
    abi: artifact.abi,
    functionName: "issuerEnabled",
    args: [issuer],
  }),
  c.readContract({
    address: registry,
    abi: artifact.abi,
    functionName: "owner",
  }),
]);
if (!code || code === "0x" || !enabled || !isAddress(owner))
  throw new Error(
    "Registry needs deployed code, an owner and an enabled issuer.",
  );
// Match executable runtime, excluding Solidity metadata suffix. No immutable constructor slots in this contract.
const runtime = artifact.deployedBytecode.object;
const executable = (value) => {
  const length = parseInt(value.slice(-4), 16);
  return value.slice(0, -4 - length * 2).toLowerCase();
};
if (executable(code) !== executable(runtime))
  throw new Error(
    "Registry runtime does not match the locally compiled contract.",
  );
const deployment = {
  chainId: 84532,
  registry,
  deploymentBlock: String(receipt.blockNumber),
  rpcUrl,
  name: "Base Sepolia",
  issuer,
  transactionHash: tx,
};
await writeFile(
  new URL("../apps/web/public/deployments.json", import.meta.url),
  JSON.stringify([deployment], null, 2) + "\n",
);
console.log(
  "Confirmed testnet manifest written. Verify source publicly and finish browser-wallet acceptance before release.",
);
