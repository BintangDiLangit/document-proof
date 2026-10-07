import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { readFile } from "node:fs/promises";
export const localChain = defineChain({
  id: 31337,
  name: "Anvil local",
  nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8547"] } },
});
// Public Anvil development account. Never fund it on any public network.
export const localAccount = mnemonicToAccount(
  "test test test test test test test test test test test junk",
);
export const client = createPublicClient({
  chain: localChain,
  transport: http(localChain.rpcUrls.default.http[0]),
});
export const wallet = createWalletClient({
  account: localAccount,
  chain: localChain,
  transport: http(localChain.rpcUrls.default.http[0]),
});
export async function artifact() {
  return JSON.parse(
    await readFile(
      new URL(
        "../contracts/out/DocumentRegistry.sol/DocumentRegistry.json",
        import.meta.url,
      ),
    ),
  );
}
export async function requireLocal() {
  if ((await client.getChainId()) !== 31337)
    throw new Error(
      "Refusing to use the public development key outside Anvil (chain 31337).",
    );
}
export async function confirmed(hash) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction reverted");
  return receipt;
}
