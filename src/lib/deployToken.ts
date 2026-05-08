import type { ConnectedWallet } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  type Address,
  parseUnits,
} from "viem";
import { arcPublicClient, arcTestnetChain } from "@/src/lib/arc/viem";

export type DeployedTokenDetails = {
  decimals: number;
  name: string;
  ownerBalance: string;
  ownerBalanceRaw: bigint;
  symbol: string;
  totalSupply: string;
  totalSupplyRaw: bigint;
};

export async function deployToken(
  name: string,
  symbol: string,
  supply: string,
  wallet: ConnectedWallet,
) {
  if (!name.trim()) throw new Error("Token name is required");
  if (!symbol.trim()) throw new Error("Token symbol is required");
  if (!supply.trim() || Number(supply) <= 0) {
    throw new Error("Token supply must be greater than zero");
  }

  await wallet.switchChain(arcTestnetChain.id);
  const provider = await wallet.getEthereumProvider();
  const walletClient = createWalletClient({
    chain: arcTestnetChain,
    transport: custom(provider),
  });
  const publicClient = createPublicClient({
    chain: arcTestnetChain,
    transport: custom(provider),
  });

  const [account] = await walletClient.getAddresses();
  const artifact = await import("../../artifacts/BoozzToken.json");
  const parsedSupply = parseUnits(supply, 18);

  const hash = await walletClient.deployContract({
    account,
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [name.trim(), symbol.trim().toUpperCase(), parsedSupply, account],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return {
    contractAddress: receipt.contractAddress,
    txHash: hash,
  };
}

export async function verifyDeployedToken(
  contractAddress: Address,
  ownerAddress: Address,
): Promise<DeployedTokenDetails> {
  const artifact = await import("../../artifacts/BoozzToken.json");
  const abi = artifact.abi;

  const [name, symbol, decimals, totalSupplyRaw, ownerBalanceRaw] =
    await Promise.all([
      arcPublicClient.readContract({
        address: contractAddress,
        abi,
        functionName: "name",
      }),
      arcPublicClient.readContract({
        address: contractAddress,
        abi,
        functionName: "symbol",
      }),
      arcPublicClient.readContract({
        address: contractAddress,
        abi,
        functionName: "decimals",
      }),
      arcPublicClient.readContract({
        address: contractAddress,
        abi,
        functionName: "totalSupply",
      }),
      arcPublicClient.readContract({
        address: contractAddress,
        abi,
        functionName: "balanceOf",
        args: [ownerAddress],
      }),
    ]);

  const tokenDecimals = Number(decimals);

  return {
    decimals: tokenDecimals,
    name: String(name),
    ownerBalance: formatUnits(ownerBalanceRaw as bigint, tokenDecimals),
    ownerBalanceRaw: ownerBalanceRaw as bigint,
    symbol: String(symbol),
    totalSupply: formatUnits(totalSupplyRaw as bigint, tokenDecimals),
    totalSupplyRaw: totalSupplyRaw as bigint,
  };
}

export async function addTokenToWallet(
  contractAddress: Address,
  symbol: string,
  decimals: number,
  wallet: ConnectedWallet,
) {
  await wallet.switchChain(arcTestnetChain.id);
  const provider = await wallet.getEthereumProvider();

  return provider.request({
    method: "wallet_watchAsset",
    params: {
      type: "ERC20",
      options: {
        address: contractAddress,
        decimals,
        symbol: symbol.trim().toUpperCase(),
      },
    } as unknown as never,
  });
}
