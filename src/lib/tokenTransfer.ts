import type { ConnectedWallet } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  isAddress,
  parseUnits,
  type Address,
} from "viem";
import { arcTestnetChain } from "@/src/lib/arc/viem";

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export async function sendToken(
  token: Address,
  to: Address,
  amount: string,
  decimals: number,
  wallet: ConnectedWallet,
) {
  if (!isAddress(token)) throw new Error("Invalid token address");
  if (!isAddress(to)) throw new Error("Invalid recipient address");
  if (!amount || Number(amount) <= 0) throw new Error("Enter a valid amount");

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
  const value = parseUnits(amount, decimals);

  const { request } = await publicClient.simulateContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to, value],
    account,
  });

  return walletClient.writeContract(request);
}
