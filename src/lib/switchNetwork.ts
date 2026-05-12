import type { ConnectedWallet } from "@privy-io/react-auth";
import { arbitrumSepolia, avalancheFuji, baseSepolia, optimismSepolia, sepolia } from "viem/chains";
import { arcTestnetChain } from "@/src/lib/arc/viem";
import type { BridgeChain } from "./bridgeUsdc";
import { PHAROS_TESTNET } from "./pharos";

const CHAIN_ID_BY_APP_KIT_CHAIN: Record<BridgeChain, number> = {
  Ethereum_Sepolia: sepolia.id,
  Base_Sepolia: baseSepolia.id,
  Arbitrum_Sepolia: arbitrumSepolia.id,
  Avalanche_Fuji: avalancheFuji.id,
  Optimism_Sepolia: optimismSepolia.id,
  Pharos_Testnet: PHAROS_TESTNET.chainId,
  Arc_Testnet: arcTestnetChain.id,
};

export async function switchNetwork(chain: BridgeChain, wallet: ConnectedWallet) {
  await wallet.switchChain(CHAIN_ID_BY_APP_KIT_CHAIN[chain]);
}
