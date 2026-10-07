export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type Proof = {
  version: 1;
  chainId: number;
  registry: Address;
  issuer: Address;
  documentId: Hex;
  sha256Hash: Hex;
  transactionHash?: Hex;
};
export type DocumentRecord = {
  sha256Hash: Hex;
  issuedAt: bigint;
  expiresAt: bigint;
  revoked: boolean;
};
export type Deployment = {
  chainId: number;
  registry: Address;
  deploymentBlock: string;
  rpcUrl: string;
  name: string;
  issuer: Address;
  transactionHash: Hex;
};
export const isAddress = (value: unknown): value is Address =>
  typeof value === "string" &&
  /^0x[\da-f]{40}$/i.test(value) &&
  !/^0x0{40}$/i.test(value);
export const isHash = (value: unknown): value is Hex =>
  typeof value === "string" &&
  /^0x[\da-f]{64}$/i.test(value) &&
  !/^0x0{64}$/i.test(value);

export function parseProof(input: unknown): Proof {
  if (typeof input !== "object" || input === null)
    throw new Error("Choose a Document Proof receipt JSON.");
  const p = input as Record<string, unknown>;
  if (
    p.version !== 1 ||
    !Number.isSafeInteger(p.chainId) ||
    Number(p.chainId) <= 0 ||
    !isAddress(p.registry) ||
    !isAddress(p.issuer) ||
    !isHash(p.documentId) ||
    !isHash(p.sha256Hash) ||
    (p.transactionHash !== undefined && !isHash(p.transactionHash))
  )
    throw new Error(
      "This receipt is incomplete or uses an unsupported format.",
    );
  return {
    version: 1,
    chainId: Number(p.chainId),
    registry: p.registry.toLowerCase() as Address,
    issuer: p.issuer.toLowerCase() as Address,
    documentId: p.documentId.toLowerCase() as Hex,
    sha256Hash: p.sha256Hash.toLowerCase() as Hex,
    ...(p.transactionHash ? { transactionHash: p.transactionHash as Hex } : {}),
  };
}

export function requireDeployment(proof: Proof, deployment: Deployment) {
  if (
    proof.chainId !== deployment.chainId ||
    proof.registry.toLowerCase() !== deployment.registry.toLowerCase()
  )
    throw new Error(
      "This receipt belongs to an unsupported network or registry. Switch to its published deployment before checking it.",
    );
}

export async function hashPdf(bytes: Uint8Array): Promise<Hex> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PDF_BYTES)
    throw new Error("Choose a PDF smaller than 20 MB.");
  const header = new TextDecoder().decode(bytes.subarray(0, 1024));
  if (!header.includes("%PDF-"))
    throw new Error(
      "This file does not have a PDF header. Choose the original PDF.",
    );
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return `0x${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function evaluateRecord(
  record: DocumentRecord,
  fileHash: Hex | null,
  chainTime: bigint,
  issuerEnabled: boolean,
) {
  const recordStatus =
    record.issuedAt === 0n
      ? "not-found"
      : record.revoked
        ? "revoked"
        : record.expiresAt !== 0n && record.expiresAt <= chainTime
          ? "expired"
          : "active";
  const integrity =
    recordStatus === "not-found" || !fileHash
      ? "unchecked"
      : record.sha256Hash.toLowerCase() === fileHash.toLowerCase()
        ? "match"
        : "mismatch";
  return { recordStatus, integrity, issuerEnabled };
}

export function proofLink(proof: Proof, origin: string) {
  const url = new URL(origin);
  url.hash = `/verify/${proof.chainId}/${proof.registry}/${proof.issuer}/${proof.documentId}`;
  return url.href;
}

export function parseProofRoute(hash: string) {
  const parts = hash.replace(/^#/, "").split("/");
  if (
    parts.length !== 6 ||
    parts[1] !== "verify" ||
    !/^\d+$/.test(parts[2]) ||
    !Number.isSafeInteger(Number(parts[2])) ||
    Number(parts[2]) <= 0 ||
    !isAddress(parts[3]) ||
    !isAddress(parts[4]) ||
    !isHash(parts[5])
  )
    return null;
  return {
    chainId: Number(parts[2]),
    registry: parts[3] as Address,
    issuer: parts[4] as Address,
    documentId: parts[5] as Hex,
  };
}
