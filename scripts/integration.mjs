import assert from "node:assert/strict";
import {
  client,
  wallet,
  localAccount,
  artifact,
  requireLocal,
  confirmed,
} from "./local-chain.mjs";
import { hash, originalPdf, certificatePdf } from "./fixtures.mjs";
import { hashPdf, evaluateRecord } from "../apps/web/src/proof.ts";
import { randomBytes } from "node:crypto";
await requireLocal();
const a = await artifact();
const r = await confirmed(
  await wallet.deployContract({
    abi: a.abi,
    bytecode: a.bytecode.object,
    args: [localAccount.address],
  }),
);
const address = r.contractAddress;
await confirmed(
  await wallet.writeContract({
    address,
    abi: a.abi,
    functionName: "setIssuer",
    args: [localAccount.address, true],
  }),
);
const documentId = `0x${randomBytes(32).toString("hex")}`;
await confirmed(
  await wallet.writeContract({
    address,
    abi: a.abi,
    functionName: "issue",
    args: [documentId, hash, 0n],
  }),
);
const read = () =>
  client.readContract({
    address,
    abi: a.abi,
    functionName: "getDocument",
    args: [localAccount.address, documentId],
  });
let record = await read();
let block = await client.getBlock();
assert.equal(
  evaluateRecord(record, await hashPdf(originalPdf), block.timestamp, true)
    .integrity,
  "match",
);
assert.equal(
  evaluateRecord(
    record,
    await hashPdf(certificatePdf("Edited Person")),
    block.timestamp,
    true,
  ).integrity,
  "mismatch",
);
await confirmed(
  await wallet.writeContract({
    address,
    abi: a.abi,
    functionName: "setIssuer",
    args: [localAccount.address, false],
  }),
);
await confirmed(
  await wallet.writeContract({
    address,
    abi: a.abi,
    functionName: "revoke",
    args: [documentId],
  }),
);
record = await read();
block = await client.getBlock();
assert.equal(
  evaluateRecord(record, hash, block.timestamp, false).recordStatus,
  "revoked",
);
assert.equal(
  evaluateRecord(record, hash, block.timestamp, false).integrity,
  "match",
);
await confirmed(
  await wallet.writeContract({
    address,
    abi: a.abi,
    functionName: "setIssuer",
    args: [localAccount.address, true],
  }),
);
const expiringId = `0x${randomBytes(32).toString("hex")}`;
const expiry = (await client.getBlock()).timestamp + 5n;
await confirmed(
  await wallet.writeContract({
    address,
    abi: a.abi,
    functionName: "issue",
    args: [expiringId, hash, expiry],
  }),
);
await client.request({ method: "evm_increaseTime", params: [10] });
await client.request({ method: "evm_mine", params: [] });
const expired = await client.readContract({
  address,
  abi: a.abi,
  functionName: "getDocument",
  args: [localAccount.address, expiringId],
});
assert.equal(
  evaluateRecord(expired, hash, (await client.getBlock()).timestamp, true)
    .recordStatus,
  "expired",
);
console.log(
  "Local EVM integration passed: issue, exact file, altered file, disable issuer, revoke, expiry. No public network or real funds used.",
);
