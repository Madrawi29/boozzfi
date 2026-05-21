import fs from "fs";
import path from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import tokenArtifact from "../artifacts/BoozzToken.json";
import vaultArtifact from "../artifacts/BoozzLiquidityVault.json";

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim() as Hex | undefined;
  if (!privateKey?.startsWith("0x")) {
    throw new Error("Set DEPLOYER_PRIVATE_KEY=0x... in .env.local or this terminal session.");
  }

  const rpcUrl =
    process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network";
  const chainId = Number(process.env.NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID || 5042002);
  const explorerUrl =
    process.env.NEXT_PUBLIC_ARC_TESTNET_EXPLORER_URL || "https://testnet.arcscan.app";
  const tokenName = process.env.BOOZZ_TOKEN_NAME || "BOOZZ Token";
  const tokenSymbol = process.env.BOOZZ_TOKEN_SYMBOL || "BOOZZ";
  const tokenSupply = process.env.BOOZZ_TOKEN_SUPPLY || "1000000000";

  const account = privateKeyToAccount(privateKey);
  const chain = {
    id: chainId,
    name: "Arc Testnet",
    nativeCurrency: {
      decimals: 18,
      name: "USDC",
      symbol: "USDC",
    },
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
  };

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  console.log(`Deployer: ${account.address}`);
  console.log(`Network: Arc Testnet (${chainId})`);

  const tokenHash = await walletClient.deployContract({
    abi: tokenArtifact.abi,
    bytecode: tokenArtifact.bytecode as Hex,
    args: [
      tokenName,
      tokenSymbol.toUpperCase(),
      parseUnits(tokenSupply, 18),
      account.address,
    ],
  });
  console.log(`BOOZZ deploy tx: ${explorerUrl}/tx/${tokenHash}`);
  const tokenReceipt = await publicClient.waitForTransactionReceipt({
    hash: tokenHash,
  });
  if (!tokenReceipt.contractAddress) {
    throw new Error("BOOZZ token deployment did not return a contract address.");
  }

  const vaultHash = await walletClient.deployContract({
    abi: vaultArtifact.abi,
    bytecode: vaultArtifact.bytecode as Hex,
  });
  console.log(`Vault deploy tx: ${explorerUrl}/tx/${vaultHash}`);
  const vaultReceipt = await publicClient.waitForTransactionReceipt({
    hash: vaultHash,
  });
  if (!vaultReceipt.contractAddress) {
    throw new Error("Vault deployment did not return a contract address.");
  }

  console.log("");
  console.log("Paste these into .env.local:");
  console.log(`NEXT_PUBLIC_BOOZZ_TOKEN_ADDRESS=${tokenReceipt.contractAddress}`);
  console.log(`NEXT_PUBLIC_BOOZZ_LIQUIDITY_VAULT_ADDRESS=${vaultReceipt.contractAddress}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
