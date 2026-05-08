import type { ConnectedWallet } from "@privy-io/react-auth";
import type { Address } from "viem";
import { arcTestnetChain } from "@/src/lib/arc/viem";

export async function connectWallet(wallet: ConnectedWallet | null) {
  if (!wallet) return null;
  await wallet.switchChain(arcTestnetChain.id);
  return wallet.address as Address;
}
