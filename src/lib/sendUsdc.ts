import type { ConnectedWallet } from "@privy-io/react-auth";
import { sendToken } from "@/src/lib/tokenTransfer";

const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

export async function sendUsdc(
  to: `0x${string}`,
  amount: string,
  wallet: ConnectedWallet,
) {
  return sendToken(ARC_USDC_ADDRESS, to, amount, 6, wallet);
}
