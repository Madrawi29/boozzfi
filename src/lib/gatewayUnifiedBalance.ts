import type { ConnectedWallet } from "@privy-io/react-auth";
import type { Address } from "viem";
import { createCircleAppKit } from "@/src/lib/circleAppKit";
import { getPrivyAdapter } from "@/src/lib/privyAdapter";

export type GatewayChain =
  | "Ethereum_Sepolia"
  | "Base_Sepolia"
  | "Arbitrum_Sepolia"
  | "Avalanche_Fuji"
  | "Optimism_Sepolia"
  | "Arc_Testnet";

export type GatewaySourceChain = GatewayChain | "Auto";

export type GatewayChainOption = {
  label: string;
  value: GatewayChain;
  chainId: number;
};

export const GATEWAY_CHAINS: GatewayChainOption[] = [
  { label: "Ethereum Sepolia", value: "Ethereum_Sepolia", chainId: 11155111 },
  { label: "Base Sepolia", value: "Base_Sepolia", chainId: 84532 },
  { label: "Arbitrum Sepolia", value: "Arbitrum_Sepolia", chainId: 421614 },
  { label: "Avalanche Fuji", value: "Avalanche_Fuji", chainId: 43113 },
  { label: "Optimism Sepolia", value: "Optimism_Sepolia", chainId: 11155420 },
  { label: "Arc Testnet", value: "Arc_Testnet", chainId: 5042002 },
];

const GATEWAY_CHAIN_IDS = GATEWAY_CHAINS.reduce(
  (next, chain) => ({ ...next, [chain.value]: chain.chainId }),
  {} as Record<GatewayChain, number>,
);

function assertAmount(amount: string) {
  const numericAmount = Number(amount);

  if (!amount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Enter a valid USDC amount.");
  }
}

export function getGatewayChainLabel(chain: GatewayChain | GatewaySourceChain) {
  if (chain === "Auto") return "Auto";
  return GATEWAY_CHAINS.find((item) => item.value === chain)?.label ?? chain;
}

export async function getGatewayUnifiedBalance(wallet: ConnectedWallet) {
  const adapter = await getPrivyAdapter(wallet);
  const kit = createCircleAppKit();

  return await kit.unifiedBalance.getBalances({
    includePending: true,
    networkType: "testnet",
    sources: {
      adapter,
      chains: GATEWAY_CHAINS.map((chain) => chain.value),
    },
    token: "USDC",
  });
}

export async function depositGatewayUsdc(
  amount: string,
  fromChain: GatewayChain,
  wallet: ConnectedWallet,
) {
  assertAmount(amount);

  await wallet.switchChain(GATEWAY_CHAIN_IDS[fromChain]);
  const adapter = await getPrivyAdapter(wallet);
  const kit = createCircleAppKit();

  return await kit.unifiedBalance.deposit({
    amount,
    from: {
      adapter,
      chain: fromChain,
    },
    token: "USDC",
  });
}

export async function spendGatewayUsdc(
  amount: string,
  sourceChain: GatewaySourceChain,
  destinationChain: GatewayChain,
  recipientAddress: Address,
  wallet: ConnectedWallet,
) {
  assertAmount(amount);

  await wallet.switchChain(GATEWAY_CHAIN_IDS[destinationChain]);
  const adapter = await getPrivyAdapter(wallet);
  const kit = createCircleAppKit();
  const from =
    sourceChain === "Auto"
      ? { adapter }
      : {
          adapter,
          allocations: {
            amount,
            chain: sourceChain,
          },
        };

  return await kit.unifiedBalance.spend({
    amount,
    from,
    to: {
      adapter,
      chain: destinationChain,
      recipientAddress,
    },
    token: "USDC",
  });
}

export async function estimateGatewaySpend(
  amount: string,
  sourceChain: GatewaySourceChain,
  destinationChain: GatewayChain,
  recipientAddress: Address,
  wallet: ConnectedWallet,
) {
  assertAmount(amount);

  const adapter = await getPrivyAdapter(wallet);
  const kit = createCircleAppKit();
  const from =
    sourceChain === "Auto"
      ? { adapter }
      : {
          adapter,
          allocations: {
            amount,
            chain: sourceChain,
          },
        };

  return await kit.unifiedBalance.estimateSpend({
    amount,
    from,
    to: {
      adapter,
      chain: destinationChain,
      recipientAddress,
    },
    token: "USDC",
  });
}
