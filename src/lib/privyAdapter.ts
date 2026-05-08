import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import {
  ArbitrumSepolia,
  ArcTestnet,
  AvalancheFuji,
  BaseSepolia,
  EthereumSepolia,
  OptimismSepolia,
} from "@circle-fin/app-kit/chains";
import type { ConnectedWallet } from "@privy-io/react-auth";

type ViemAdapterProvider = Parameters<
  typeof createViemAdapterFromProvider
>[0]["provider"];

const PRIVY_APP_KIT_CHAINS = [
  ArcTestnet,
  EthereumSepolia,
  BaseSepolia,
  ArbitrumSepolia,
  AvalancheFuji,
  OptimismSepolia,
] as const;

export async function getPrivyAdapter(wallet: ConnectedWallet) {
  const provider = await wallet.getEthereumProvider();

  return await createViemAdapterFromProvider({
    provider: provider as unknown as ViemAdapterProvider,
    capabilities: {
      addressContext: "developer-controlled",
      supportedChains: [...PRIVY_APP_KIT_CHAINS],
    },
  });
}
