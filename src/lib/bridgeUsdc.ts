import { TransferSpeed } from "@circle-fin/app-kit";
import type { ConnectedWallet } from "@privy-io/react-auth";
import type { Address } from "viem";
import { createCircleAppKit } from "./circleAppKit";
import { getPrivyAdapter } from "./privyAdapter";

export type BridgeChain =
  | "Ethereum_Sepolia"
  | "Base_Sepolia"
  | "Arbitrum_Sepolia"
  | "Avalanche_Fuji"
  | "Optimism_Sepolia"
  | "Pharos_Testnet"
  | "Arc_Testnet";

const BRIDGE_CHAIN_ID: Record<BridgeChain, number> = {
  Ethereum_Sepolia: 11155111,
  Base_Sepolia: 84532,
  Arbitrum_Sepolia: 421614,
  Avalanche_Fuji: 43113,
  Optimism_Sepolia: 11155420,
  Pharos_Testnet: 688689,
  Arc_Testnet: 5042002,
};

function supportsForwarder(fromChain: BridgeChain, toChain: BridgeChain) {
  return fromChain !== "Pharos_Testnet" && toChain !== "Pharos_Testnet";
}

function getBridgeFeeUsdc(estimate: { fees: Array<{ amount: string | null }> }) {
  return estimate.fees.reduce((total, fee) => {
    const amount = fee.amount ? Number.parseFloat(fee.amount) : 0;
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);
}

export async function bridgeUsdc(
  amount: string,
  fromChain: BridgeChain,
  toChain: BridgeChain,
  wallet: ConnectedWallet
) {
  if (!wallet) throw new Error("Privy wallet not found");

  const adapter = await getPrivyAdapter(wallet);
  const address = wallet.address as Address;

  const kit = createCircleAppKit();
  await wallet.switchChain(BRIDGE_CHAIN_ID[fromChain]);
  const useForwarder = supportsForwarder(fromChain, toChain);

  const bridgeParams = useForwarder
    ? {
        from: {
          adapter,
          chain: fromChain,
          address,
        },
        to: {
          chain: toChain,
          recipientAddress: address,
          useForwarder: true as const,
        },
        amount,
        config: {
          batchTransactions: false,
          transferSpeed: TransferSpeed.SLOW,
        },
      }
    : {
        from: {
          adapter,
          chain: fromChain,
          address,
        },
        to: {
          adapter,
          chain: toChain,
          address,
          recipientAddress: address,
          useForwarder: false as const,
        },
        amount,
        config: {
          batchTransactions: false,
          transferSpeed: TransferSpeed.SLOW,
        },
      };
  const estimate = await kit.estimateBridge(bridgeParams);
  const feeUsdc = getBridgeFeeUsdc(estimate);
  const amountUsdc = Number.parseFloat(amount);

  if (feeUsdc > 0 && Number.isFinite(amountUsdc) && feeUsdc >= amountUsdc) {
    throw new Error(
      `Bridge amount is too low for the current route fee. Estimated route fee is ${feeUsdc.toFixed(6)} USDC, so try a larger amount.`,
    );
  }

  return await kit.bridge(bridgeParams);
}
