import type { ConnectedWallet } from "@privy-io/react-auth";
import { isAddress, type Address } from "viem";
import { arcTestnetChain } from "@/src/lib/arc/viem";
import { createCircleAppKit } from "@/src/lib/circleAppKit";
import { getPrivyAdapter } from "@/src/lib/privyAdapter";

export async function sendToken(
  token: Address,
  to: Address,
  amount: string,
  _decimals: number,
  wallet: ConnectedWallet,
) {
  if (!isAddress(token)) throw new Error("Invalid token address");
  if (!isAddress(to)) throw new Error("Invalid recipient address");
  if (!amount || Number(amount) <= 0) throw new Error("Enter a valid amount");

  await wallet.switchChain(arcTestnetChain.id);
  const adapter = await getPrivyAdapter(wallet);
  const kit = createCircleAppKit();
  const result = await kit.send({
    amount,
    from: {
      adapter,
      chain: "Arc_Testnet",
    },
    to,
    token,
  });

  if (!result.txHash) {
    throw new Error("App Kit send did not return a transaction hash.");
  }

  return result.txHash as `0x${string}`;
}
