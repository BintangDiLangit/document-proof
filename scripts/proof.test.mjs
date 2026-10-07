import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPdf,
  evaluateRecord,
  parseProof,
  requireDeployment,
  parseProofRoute,
  proofLink,
  MAX_PDF_BYTES,
} from "../apps/web/src/proof.ts";
const hash = "0x" + "ab".repeat(32);
const issuer = "0x" + "12".repeat(20);
const registry = "0x" + "34".repeat(20);
const proof = {
  version: 1,
  chainId: 31337,
  issuer,
  registry,
  documentId: hash,
  sha256Hash: hash,
};
test("exact bytes match; renamed bytes match; changed bytes do not", async () => {
  const bytes = new TextEncoder().encode("%PDF-1.4 original");
  const original = await hashPdf(bytes);
  assert.equal(await hashPdf(Uint8Array.from(bytes)), original);
  assert.notEqual(
    await hashPdf(new TextEncoder().encode("%PDF-1.4 altered")),
    original,
  );
  await assert.rejects(hashPdf(new TextEncoder().encode("not a PDF")));
  await assert.rejects(hashPdf(new Uint8Array(MAX_PDF_BYTES + 1)));
});
test("record lifecycle, integrity and issuer permission are separate", () => {
  const record = {
    sha256Hash: hash,
    issuedAt: 5n,
    expiresAt: 10n,
    revoked: false,
  };
  assert.deepEqual(evaluateRecord(record, hash, 9n, false), {
    recordStatus: "active",
    integrity: "match",
    issuerEnabled: false,
  });
  assert.equal(evaluateRecord(record, hash, 10n, true).recordStatus, "expired");
  assert.equal(
    evaluateRecord({ ...record, revoked: true }, hash, 11n, true).recordStatus,
    "revoked",
  );
  assert.equal(evaluateRecord(record, null, 9n, true).integrity, "unchecked");
  assert.equal(
    evaluateRecord({ ...record, issuedAt: 0n }, hash, 9n, true).integrity,
    "unchecked",
  );
  assert.equal(
    evaluateRecord(record, "0x" + "cd".repeat(32), 9n, true).integrity,
    "mismatch",
  );
});
test("receipts cannot select arbitrary registries; share URLs round-trip", () => {
  const parsed = parseProof(proof);
  requireDeployment(parsed, {
    ...proof,
    deploymentBlock: "0",
    rpcUrl: "http://localhost",
    name: "Local",
    transactionHash: hash,
  });
  assert.throws(() => requireDeployment(parsed, { ...proof, chainId: 84532 }));
  assert.throws(() => parseProof({ ...proof, issuer: "javascript:alert(1)" }));
  assert.throws(() => parseProof({ ...proof, version: 2 }));
  assert.equal(
    parseProofRoute(
      new URL(proofLink(parsed, "https://example.org/document-proof/")).hash,
    ).documentId,
    hash,
  );
  assert.equal(parseProofRoute("#/verify/1/invalid/invalid/id"), null);
});
