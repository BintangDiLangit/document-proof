import { writeFile, mkdir } from "node:fs/promises";
import {
  client,
  wallet,
  localAccount,
  artifact,
  requireLocal,
  confirmed,
} from "./local-chain.mjs";
import { writeFixtures, hash, ids } from "./fixtures.mjs";
await requireLocal();
await writeFixtures();
const contract = await artifact();
const transactionHash = await wallet.deployContract({
  abi: contract.abi,
  bytecode: contract.bytecode.object,
  args: [localAccount.address],
});
const receipt = await confirmed(transactionHash);
const registry = receipt.contractAddress;
await confirmed(
  await wallet.writeContract({
    address: registry,
    abi: contract.abi,
    functionName: "setIssuer",
    args: [localAccount.address, true],
  }),
);
const proofs = {};
for (const [name, id] of Object.entries(ids)) {
  const expiry =
    name === "expired" ? (await client.getBlock()).timestamp + 30n : 0n;
  const tx = await wallet.writeContract({
    address: registry,
    abi: contract.abi,
    functionName: "issue",
    args: [id, hash, expiry],
  });
  await confirmed(tx);
  proofs[name] = {
    version: 1,
    chainId: 31337,
    registry,
    issuer: localAccount.address,
    documentId: id,
    sha256Hash: hash,
    transactionHash: tx,
  };
  if (name === "revoked")
    await confirmed(
      await wallet.writeContract({
        address: registry,
        abi: contract.abi,
        functionName: "revoke",
        args: [id],
      }),
    );
}
await client.request({ method: "evm_increaseTime", params: [31] });
await client.request({ method: "evm_mine", params: [] });
const deployment = {
  chainId: 31337,
  registry,
  deploymentBlock: String(receipt.blockNumber),
  rpcUrl: "http://127.0.0.1:8547",
  name: "Local Anvil",
  issuer: localAccount.address,
  transactionHash,
};
await mkdir(new URL("../.local/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../.local/deployment.json", import.meta.url),
  JSON.stringify(deployment, null, 2) + "\n",
);
await writeFile(
  new URL("../.local/original.receipt.json", import.meta.url),
  JSON.stringify(proofs.active, null, 2) + "\n",
);
await writeFile(
  new URL("../apps/web/public/local-deployment.json", import.meta.url),
  JSON.stringify(deployment, null, 2) + "\n",
);
await writeFile(
  new URL("../apps/web/public/local-proofs.json", import.meta.url),
  JSON.stringify(proofs, null, 2) + "\n",
);
console.log(
  `Registry deployed at ${registry}, block ${receipt.blockNumber}. Real local-chain samples include active, revoked and expired records.`,
);
console.log(`Owner / test issuer: ${localAccount.address}`);
