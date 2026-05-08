import { AppKit, TransferSpeed } from "@circle-fin/app-kit";
import type { ConnectedWallet } from "@privy-io/react-auth";
import type { Address } from "viem";
import { getPrivyAdapter } from "./privyAdapter";

export type BridgeChain =
  | "Ethereum_Sepolia"
  | "Base_Sepolia"
  | "Arbitrum_Sepolia"
  | "Avalanche_Fuji"
  | "Optimism_Sepolia"
  | "Arc_Testnet";

const BRIDGE_CHAIN_ID: Record<BridgeChain, number> = {
  Ethereum_Sepolia: 11155111,
  Base_Sepolia: 84532,
  Arbitrum_Sepolia: 421614,
  Avalanche_Fuji: 43113,
  Optimism_Sepolia: 11155420,
  Arc_Testnet: 5042002,
};

export async function bridgeUsdc(
  amount: string,
  fromChain: BridgeChain,
  toChain: BridgeChain,
  wallet: ConnectedWallet
) {
  if (!wallet) throw new Error("Privy wallet not found");

  const adapter = await getPrivyAdapter(wallet);
  const address = wallet.address as Address;

  const kit = new AppKit();
  await wallet.switchChain(BRIDGE_CHAIN_ID[fromChain]);

  return await kit.bridge({
    from: {
      adapter,
      chain: fromChain,
      address,
    },
    to: {
      chain: toChain,
      recipientAddress: address,
      useForwarder: true,
    },
    amount,
    config: {
      batchTransactions: false,
      transferSpeed: TransferSpeed.SLOW,
    },
  });
}
