import fs from "fs";
import path from "path";
import solc from "solc";

const contractPath = path.join(process.cwd(), "contracts", "BoozzToken.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
    language: "Solidity",
    sources: {
        "BoozzToken.sol": { content: source },
    },
    settings: {
        outputSelection: {
            "*": {
                "*": ["abi", "evm.bytecode.object"],
            },
        },
    },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const c = output.contracts["BoozzToken.sol"]["BoozzToken"];

const outDir = path.join(process.cwd(), "artifacts");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

fs.writeFileSync(
    path.join(outDir, "BoozzToken.json"),
    JSON.stringify(
        {
            abi: c.abi,
            bytecode: `0x${c.evm.bytecode.object}`,
        },
        null,
        2
    )
);

console.log("Compiled → artifacts/BoozzToken.json");