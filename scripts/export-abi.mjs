import { readFile, writeFile, mkdir } from "node:fs/promises";
const artifact = JSON.parse(
  await readFile(
    new URL(
      "../contracts/out/DocumentRegistry.sol/DocumentRegistry.json",
      import.meta.url,
    ),
  ),
);
await mkdir(new URL("../apps/web/src/generated/", import.meta.url), {
  recursive: true,
});
await writeFile(
  new URL("../apps/web/src/generated/registry.ts", import.meta.url),
  `// Generated from the compiled contract. Run pnpm contracts:build.\nexport const registryAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`,
);
