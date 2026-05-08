import { getBalances } from "./getBalances";

export async function waitForBalanceIncrease(
  address: `0x${string}`,
  before: number,
  options: { intervalMs?: number; maxAttempts?: number } = {},
) {
  const intervalMs = options.intervalMs ?? 5_000;
  const maxAttempts = options.maxAttempts ?? 60;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const now = await getBalances(address);
    if (now.usdc > before) {
      return true;
    }
  }

  throw new Error("Timed out waiting for Arc USDC balance to update.");
}
