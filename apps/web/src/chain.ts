import { createPublicClient, defineChain, http, type WalletClient } from "viem";
import { baseSepolia } from "viem/chains";
import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { registryAbi } from "./generated/registry";
import {
  evaluateRecord,
  isAddress,
  isHash,
  type Deployment,
  type Proof,
  type Address,
  type Hex,
} from "./proof";

export const localChain = defineChain({
  id: 31337,
  name: "Anvil local",
  nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8547"] } },
});
export const walletConfig = createConfig({
  chains: [baseSepolia, localChain],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
    [localChain.id]: http("http://127.0.0.1:8547"),
  },
});
export const publicClient = (d: Deployment) =>
  createPublicClient({
    chain: d.chainId === 31337 ? localChain : baseSepolia,
    transport: http(d.rpcUrl, { timeout: 10000, retryCount: 1 }),
  });

export async function loadDeployment(): Promise<Deployment | null> {
  const file = import.meta.env.DEV
    ? "local-deployment.json"
    : "deployments.json";
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${file}`, {
      cache: "no-store",
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("json"))
      return null;
    const data = await response.json();
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    const url = new URL(d.rpcUrl);
    const allowed =
      d.chainId === 84532 ||
      (import.meta.env.DEV &&
        d.chainId === 31337 &&
        ["127.0.0.1", "localhost"].includes(url.hostname));
    if (
      !allowed ||
      !isAddress(d.registry) ||
      !isAddress(d.issuer) ||
      !isHash(d.transactionHash) ||
      !/^\d+$/.test(d.deploymentBlock) ||
      !["http:", "https:"].includes(url.protocol)
    )
      throw new Error("Invalid published deployment configuration.");
    return d as Deployment;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Invalid published deployment configuration."
    )
      throw error;
    return null;
  }
}

export async function lookup(
  d: Deployment,
  issuer: Address,
  documentId: Hex,
  fileHash: Hex | null,
) {
  const client = publicClient(d);
  if ((await client.getChainId()) !== d.chainId)
    throw new Error("The RPC is connected to a different network.");
  const block = await client.getBlock();
  const [record, enabled] = await Promise.all([
    client.readContract({
      address: d.registry,
      abi: registryAbi,
      functionName: "getDocument",
      args: [issuer, documentId],
      blockNumber: block.number,
    }),
    client.readContract({
      address: d.registry,
      abi: registryAbi,
      functionName: "issuerEnabled",
      args: [issuer],
      blockNumber: block.number,
    }),
  ]);
  return {
    record,
    ...evaluateRecord(record, fileHash, block.timestamp, enabled),
    block: String(block.number),
    proof:
      record.issuedAt === 0n
        ? null
        : {
            version: 1 as const,
            chainId: d.chainId,
            registry: d.registry,
            issuer,
            documentId,
            sha256Hash: record.sha256Hash,
          },
  };
}
export type LookupResult = Awaited<ReturnType<typeof lookup>>;

export async function recentDocuments(
  d: Deployment,
  issuer: Address,
  before?: bigint,
) {
  const client = publicClient(d);
  const latest = before ?? (await client.getBlockNumber());
  const floor = BigInt(d.deploymentBlock);
  if (latest < floor) return { proofs: [] as Proof[], next: null };
  // ponytail: bounded RPC scans; add an event indexer if high-volume history needs it.
  const from = latest - floor > 2000n ? latest - 2000n : floor;
  const events = await client.getContractEvents({
    address: d.registry,
    abi: registryAbi,
    eventName: "DocumentIssued",
    args: { issuer },
    fromBlock: from,
    toBlock: latest,
  });
  const proofs = events
    .reverse()
    .map((e) => ({
      version: 1 as const,
      chainId: d.chainId,
      registry: d.registry,
      issuer,
      documentId: e.args.documentId!,
      sha256Hash: e.args.sha256Hash!,
      transactionHash: e.transactionHash!,
    }));
  return { proofs, next: from > floor ? from - 1n : null };
}

export async function localDevWallet() {
  if (!import.meta.env.DEV)
    throw new Error(
      "Local development wallet is unavailable in public builds.",
    );
  const { mnemonicToAccount } = await import("viem/accounts");
  const { createWalletClient } = await import("viem");
  const account = mnemonicToAccount(
    "test test test test test test test test test test test junk",
  );
  const wallet = createWalletClient({
    account,
    chain: localChain,
    transport: http("http://127.0.0.1:8547"),
  });
  if ((await wallet.getChainId()) !== 31337)
    throw new Error("Development wallet only works on the local chain.");
  return wallet;
}

export async function simulateWrite(
  d: Deployment,
  wallet: WalletClient,
  fn: "issue" | "revoke" | "setIssuer",
  args: readonly unknown[],
) {
  if (!wallet.account) throw new Error("Connect a wallet first.");
  if ((await wallet.getChainId()) !== d.chainId)
    throw new Error(`Switch your wallet to ${d.name}.`);
  const client = publicClient(d);
  const request = {
    address: d.registry,
    abi: registryAbi,
    functionName: fn,
    args,
    account: wallet.account.address,
  } as const;
  await client.simulateContract(
    request as Parameters<typeof client.simulateContract>[0],
  );
  const gas = await client.estimateContractGas(
    request as Parameters<typeof client.estimateContractGas>[0],
  );
  const fee = await client.estimateFeesPerGas();
  return { gas, maxCost: gas * (fee.maxFeePerGas ?? fee.gasPrice ?? 0n) };
}

export async function sendWrite(
  d: Deployment,
  wallet: WalletClient,
  fn: "issue" | "revoke" | "setIssuer",
  args: readonly unknown[],
) {
  if (!wallet.account) throw new Error("Connect a wallet first.");
  if ((await wallet.getChainId()) !== d.chainId)
    throw new Error("Wallet network changed. Review the transaction again.");
  return wallet.writeContract({
    address: d.registry,
    abi: registryAbi,
    functionName: fn,
    args,
    account: wallet.account,
    chain: d.chainId === 31337 ? localChain : baseSepolia,
  } as Parameters<typeof wallet.writeContract>[0]);
}

export function humanError(error: unknown) {
  const e = error as { shortMessage?: string; message?: string };
  const text =
    e?.shortMessage ||
    e?.message ||
    "The request could not be completed. Try again.";
  return text.length > 320 ? text.slice(0, 320) + "…" : text;
}
