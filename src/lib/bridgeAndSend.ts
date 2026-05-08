import type { ConnectedWallet } from "@privy-io/react-auth";
import { bridgeUsdc, type BridgeChain } from "./bridgeUsdc";
import { getBalances } from "./getBalances";
import { sendToken } from "./tokenTransfer";
import { waitForBalanceIncrease } from "./waitForBalance";

const ARC_USDC = "0x3600000000000000000000000000000000000000";

export async function bridgeAndSend(
  amount: string,
  recipient: `0x${string}`,
  userAddress: `0x${string}`,
  wallet: ConnectedWallet,
  fromChain: BridgeChain = "Ethereum_Sepolia",
) {
  const before = await getBalances(userAddress);

  await bridgeUsdc(amount, fromChain, "Arc_Testnet", wallet);
  await waitForBalanceIncrease(userAddress, before.usdc);

  return sendToken(ARC_USDC, recipient, amount, 6, wallet);
}
