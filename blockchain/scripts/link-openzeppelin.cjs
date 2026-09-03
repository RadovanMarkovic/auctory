// The contracts use Remix-style versioned imports ("@openzeppelin/contracts@5.0.2/...")
// so the same source compiles unchanged in Remix and in Hardhat. Hardhat resolves
// imports from node_modules, so mirror the installed package under the versioned name.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "node_modules", "@openzeppelin");
const source = path.join(root, "contracts");
const target = path.join(root, "contracts@5.0.2");

if (!fs.existsSync(source)) process.exit(0);
if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
fs.symlinkSync("contracts", target, "junction");
