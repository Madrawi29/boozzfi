import fs from "fs";
import path from "path";
import { createPublicClient, createWalletClient, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import lendingArtifact from "../artifacts/BoozzLendingVault.json";

type MarketConfig = {
  address: `0x${string}`;
  collateralFactorBps: number;
  decimals: number;
  priceUsd: string;
  symbol: string;
};

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

function getMarketConfig(): MarketConfig[] {
  const boozzAddress = process.env.NEXT_PUBLIC_BOOZZ_TOKEN_ADDRESS as
    | `0x${string}`
    | undefined;

  return [
    {
      address: "0x3600000000000000000000000000000000000000",
      collateralFactorBps: 8200,
      decimals: 6,
      priceUsd: "1",
      symbol: "USDC",
    },
    {
      address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
      collateralFactorBps: 7800,
      decimals: 6,
      priceUsd: "1",
      symbol: "EURC",
    },
    {
      address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
      collateralFactorBps: 6400,
      decimals: 8,
      priceUsd: "100000",
      symbol: "cirBTC",
    },
    ...(boozzAddress?.startsWith("0x")
      ? [
          {
            address: boozzAddress,
            collateralFactorBps: 4200,
            decimals: 18,
            priceUsd: "0.3",
            symbol: "BOOZZ",
          } satisfies MarketConfig,
        ]
      : []),
  ];
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

  const deployHash = await walletClient.deployContract({
    abi: lendingArtifact.abi,
    bytecode: lendingArtifact.bytecode as Hex,
  });
  console.log(`Lending vault deploy tx: ${explorerUrl}/tx/${deployHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  if (!receipt.contractAddress) {
    throw new Error("Lending vault deployment did not return a contract address.");
  }

  const markets = getMarketConfig();
  for (const market of markets) {
    const priceUsdE18 = parseUnits(market.priceUsd, 18);
    const hash = await walletClient.writeContract({
      abi: lendingArtifact.abi,
      address: receipt.contractAddress,
      functionName: "setMarket",
      args: [
        market.address,
        market.decimals,
        market.collateralFactorBps,
        priceUsdE18,
        true,
      ],
    });
    console.log(`${market.symbol} market tx: ${explorerUrl}/tx/${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
  }

  console.log("");
  console.log("Paste this into .env.local:");
  console.log(`NEXT_PUBLIC_BOOZZ_LENDING_VAULT_ADDRESS=${receipt.contractAddress}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
