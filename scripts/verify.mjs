import { readFile } from "node:fs/promises";
import { createPublicClient, http } from "viem";
import {
  parseProof,
  requireDeployment,
  hashPdf,
  evaluateRecord,
} from "../apps/web/src/proof.ts";
const args = process.argv.slice(2);
if (args.length !== 3) {
  console.error(
    "Usage: pnpm verify <deployment.json> <receipt.json> <document.pdf>",
  );
  process.exit(1);
}
try {
  const deployment = JSON.parse(await readFile(args[0], "utf8"));
  const proof = parseProof(JSON.parse(await readFile(args[1], "utf8")));
  requireDeployment(proof, deployment);
  const client = createPublicClient({
    transport: http(deployment.rpcUrl, { timeout: 10000, retryCount: 1 }),
  });
  if ((await client.getChainId()) !== proof.chainId)
    throw new Error("RPC network differs from the trusted deployment.");
  const { abi } = JSON.parse(
    await readFile(
      new URL(
        "../contracts/out/DocumentRegistry.sol/DocumentRegistry.json",
        import.meta.url,
      ),
    ),
  );
  const block = await client.getBlock();
  const [record, enabled] = await Promise.all([
    client.readContract({
      address: proof.registry,
      abi,
      functionName: "getDocument",
      args: [proof.issuer, proof.documentId],
      blockNumber: block.number,
    }),
    client.readContract({
      address: proof.registry,
      abi,
      functionName: "issuerEnabled",
      args: [proof.issuer],
      blockNumber: block.number,
    }),
  ]);
  const result = evaluateRecord(
    record,
    await hashPdf(new Uint8Array(await readFile(args[2]))),
    block.timestamp,
    enabled,
  );
  console.log(
    JSON.stringify(
      {
        ...result,
        block: String(block.number),
        issuer: proof.issuer,
        documentId: proof.documentId,
      },
      null,
      2,
    ),
  );
  process.exitCode =
    result.integrity === "match" &&
    result.recordStatus === "active" &&
    result.issuerEnabled
      ? 0
      : 2;
} catch (error) {
  console.error("Status could not be verified:", error.message);
  process.exitCode = 3;
}
