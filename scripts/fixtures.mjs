import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Small deterministic PDFs. The person and training provider are fictional.
export function certificatePdf(name = "Alex Example") {
  const text = `BT /F1 26 Tf 60 710 Td (Certificate of completion) Tj 0 -60 Td /F1 16 Tf (${name}) Tj 0 -38 Td (Open Learning Studio - fictional demo issuer) Tj 0 -38 Td (Introduction to secure software) Tj 0 -70 Td /F1 11 Tf (Sample only. Not an accredited or real credential.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(body);
}
export const originalPdf = certificatePdf();
export const hash = `0x${createHash("sha256").update(originalPdf).digest("hex")}`;
export const issuer = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
export const ids = {
  active: "0x" + "11".repeat(32),
  revoked: "0x" + "22".repeat(32),
  expired: "0x" + "33".repeat(32),
};
export async function writeFixtures() {
  const root = new URL("../apps/web/public/samples/", import.meta.url);
  await mkdir(root, { recursive: true });
  await writeFile(new URL("original.pdf", root), originalPdf);
  await writeFile(
    new URL("altered.pdf", root),
    certificatePdf("Another Example"),
  );
  await writeFile(
    new URL("demo.json", root),
    JSON.stringify({ issuer, sha256Hash: hash, ids }, null, 2) + "\n",
  );
}
if (process.argv[1]?.endsWith("/fixtures.mjs")) await writeFixtures();
