"use client";

import { useEffect, useState } from "react";
import type { Hash } from "viem";
import { FeatureHeader } from "@/src/components/FeatureHeader";
import styles from "@/src/components/FeaturePage.module.css";
import {
  MinimumTransactionNotice,
  TransactionProcessing,
} from "@/src/components/TransactionNotice";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { recordActivity, updateActivityStatus } from "@/src/lib/activity";
import { getArcExplorerTxUrl } from "@/src/lib/explorers";
import { getBalances } from "@/src/lib/getBalances";
import { waitForArcTransactionStatus } from "@/src/lib/transactions";
import {
  getSwapErrorMessage,
  swapTokens,
  type SwapToken,
} from "@/src/lib/swapTokens";

const ARC_SWAP_TOKENS: SwapToken[] = ["USDC", "EURC", "cirBTC"];

export default function SwapPage() {
  const { address, login, wallet, switchToArc } = useAppWallet();
  const [tokenIn, setTokenIn] = useState<SwapToken>("USDC");
  const [tokenOut, setTokenOut] = useState<SwapToken>("EURC");
  const [amountIn, setAmountIn] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState(0);

  useEffect(() => {
    if (!address) {
      setUsdcBalance(0);
      return;
    }

    getBalances(address)
      .then((balances) => setUsdcBalance(balances.usdc))
      .catch(() => setUsdcBalance(0));
  }, [address]);

  const handleSwap = async () => {
    try {
      if (!wallet) {
        login();
        setStatus("Connect with Privy first.");
        return;
      }
      if (!amountIn || Number(amountIn) <= 0) {
        setStatus("Enter a valid amount.");
        return;
      }
      if (tokenIn === tokenOut) {
        setStatus("Choose two different tokens.");
        return;
      }

      setLoading(true);
      setTxHash("");
      setStatus(`Swapping ${tokenIn} to ${tokenOut}...`);
      await switchToArc();
      const result = await swapTokens(tokenIn, tokenOut, amountIn, wallet);
      setTxHash(result.txHash);
      await recordActivity({
        walletAddress: wallet.address,
        type: "Swap",
        asset: `${tokenIn} to ${tokenOut} on Arc Testnet`,
        amount: Number(amountIn),
        status: "Pending",
        txHash: result.txHash,
      });
      setStatus("Swap submitted. Waiting for confirmation...");
      const activityStatus = await waitForArcTransactionStatus(
        result.txHash as Hash,
      );
      await updateActivityStatus(result.txHash, activityStatus);
      if (address) {
        const balances = await getBalances(address);
        setUsdcBalance(balances.usdc);
      }
      setStatus(
        activityStatus === "Success"
          ? "Swap confirmed."
          : "Swap transaction failed.",
      );
    } catch (error) {
      if (wallet) {
        await recordActivity({
          walletAddress: wallet.address,
          type: "Swap",
          asset: `${tokenIn} to ${tokenOut} on Arc Testnet`,
          amount: Number(amountIn) || 0,
          status: "Failed",
        });
      }
      setStatus(getSwapErrorMessage(error, tokenIn, tokenOut));
    } finally {
      setLoading(false);
    }
  };

  const flipTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
  };

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
      <FeatureHeader title="Swap Arc Testnet" />

      <p className={styles.balanceLine}>
        USDC Balance{" "}
        <b className={styles.balanceValue}>{usdcBalance.toFixed(6)} USDC</b>
      </p>

      <div className={styles.formGrid}>
        <MinimumTransactionNotice />

        <select
          className={styles.field}
          value={tokenIn}
          onChange={(event) => setTokenIn(event.target.value as SwapToken)}
        >
          {ARC_SWAP_TOKENS.map((token) => (
            <option key={token} value={token}>
              From: {token}
            </option>
          ))}
        </select>

        <div className={styles.buttonRow}>
          <button className={styles.secondaryButton} onClick={flipTokens}>
            Flip
          </button>
        </div>

        <select
          className={styles.field}
          value={tokenOut}
          onChange={(event) => setTokenOut(event.target.value as SwapToken)}
        >
          {ARC_SWAP_TOKENS.map((token) => (
            <option key={token} value={token}>
              To: {token}
            </option>
          ))}
        </select>

        <input
          className={styles.field}
          placeholder={`Amount ${tokenIn}`}
          value={amountIn}
          onChange={(event) => setAmountIn(event.target.value)}
        />

        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            onClick={handleSwap}
            disabled={loading}
          >
            {loading ? "Swapping..." : `Swap ${tokenIn} to ${tokenOut}`}
          </button>
        </div>

        <TransactionProcessing
          active={loading}
          label="Waiting for the swap transaction to process..."
        />
      </div>

      {status && <p className={styles.statusText}>{status}</p>}

      {txHash && (
        <p className={styles.txLine}>
          Tx:{" "}
          <a
            className={styles.link}
            href={getArcExplorerTxUrl(txHash)}
            rel="noreferrer"
            target="_blank"
          >
            View transaction
          </a>
        </p>
      )}
      </section>
    </main>
  );
}
