import fs from "fs";
import path from "path";
import solc from "solc";

const contractDir = path.join(process.cwd(), "contracts");
const contractFiles = [
  "BoozzToken.sol",
  "BoozzLiquidityVault.sol",
  "BoozzLendingVault.sol",
];

const input = {
  language: "Solidity",
  sources: Object.fromEntries(
    contractFiles.map((fileName) => [
      fileName,
      { content: fs.readFileSync(path.join(contractDir, fileName), "utf8") },
    ]),
  ),
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors?.filter(
  (error: { severity: string }) => error.severity === "error",
);

if (errors?.length) {
  console.error(errors);
  process.exit(1);
}

const outDir = path.join(process.cwd(), "artifacts");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

for (const fileName of contractFiles) {
  const contracts = output.contracts[fileName];

  for (const [contractName, compiled] of Object.entries(contracts)) {
    const contract = compiled as {
      abi: unknown;
      evm: { bytecode: { object: string } };
    };
    if (!contract.evm.bytecode.object) continue;

    fs.writeFileSync(
      path.join(outDir, `${contractName}.json`),
      JSON.stringify(
        {
          abi: contract.abi,
          bytecode: `0x${contract.evm.bytecode.object}`,
        },
        null,
        2,
      ),
    );
  }
}

console.log("Compiled contracts to artifacts/");
