import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

const requiredFiles = [
  "app/page.tsx",
  "contracts/GenLayerEvidenceResolutionAgent.py",
  "lib/genlayer/client.ts",
  "lib/genlayer/networks.ts",
  "README.md"
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(cwd, file)));

if (missing.length) {
  console.error("Missing required GenLayer MVP files:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const envExample = path.join(cwd, ".env.example");
if (!fs.existsSync(envExample)) {
  console.error("Missing .env.example");
  process.exit(1);
}

const envText = fs.readFileSync(envExample, "utf8");
for (const key of ["NEXT_PUBLIC_GENLAYER_DEFAULT_NETWORK", "NEXT_PUBLIC_GENLAYER_DEFAULT_CONTRACT_ADDRESS"]) {
  if (!envText.includes(`${key}=`)) {
    console.error(`Expected ${key} in .env.example`);
    process.exit(1);
  }
}

const contractText = fs.readFileSync(path.join(cwd, "contracts/GenLayerEvidenceResolutionAgent.py"), "utf8");
for (const pattern of ["gl.nondet.web.get", "gl.nondet.exec_prompt", "gl.vm.run_nondet_unsafe", "class GenLayerEvidenceResolutionAgent"]) {
  if (!contractText.includes(pattern)) {
    console.error(`Contract is missing required GenLayer-native pattern: ${pattern}`);
    process.exit(1);
  }
}

const embeddedContractSource = fs.readFileSync(path.join(cwd, "lib/genlayer/contractSource.ts"), "utf8");
const sourceMatch = embeddedContractSource.match(/GENLAYER_CONTRACT_SOURCE = `([\s\S]*)`;/);
if (!sourceMatch) {
  console.error("Unable to locate embedded contract source in lib/genlayer/contractSource.ts");
  process.exit(1);
}

const normalize = (value) => value.replace(/\r\n/g, "\n").trim();
if (normalize(sourceMatch[1]) !== normalize(contractText)) {
  console.error("Embedded deployable contract source is out of sync with contracts/GenLayerEvidenceResolutionAgent.py");
  process.exit(1);
}

console.log("GenLayer MVP config check passed.");
