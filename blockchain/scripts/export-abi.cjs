/* Exports the compiled AuctoryCertificate ABI to blockchain/abi/. */
const fs = require("node:fs");
const path = require("node:path");

const artifactPath = path.join(
  __dirname,
  "..",
  "artifacts",
  "contracts",
  "AuctoryCertificate.sol",
  "AuctoryCertificate.json",
);

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const outDir = path.join(__dirname, "..", "abi");
fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, "AuctoryCertificate.json");
fs.writeFileSync(
  outFile,
  `${JSON.stringify({ contractName: artifact.contractName, abi: artifact.abi }, null, 2)}\n`,
);

console.log(`ABI written to ${outFile} (${artifact.abi.length} entries)`);
