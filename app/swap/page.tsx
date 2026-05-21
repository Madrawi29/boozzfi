"use client";

import { useEffect, useState } from "react";
import type { Hash } from "viem";
import { FeatureHeader } from "@/src/components/FeatureHeader";
import styles from "@/src/components/FeaturePage.module.css";
import { AmountPercentControls } from "@/src/components/TokenBalanceControls";
import { TokenIcon } from "@/src/components/TokenIcon";
import {
  MinimumTransactionNotice,
  TransactionProcessing,
} from "@/src/components/TransactionNotice";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { recordActivity, updateActivityStatus } from "@/src/lib/activity";
import { getArcExplorerTxUrl } from "@/src/lib/explorers";
import { getBalances, type WalletTokenBalance } from "@/src/lib/getBalances";
import { waitForArcTransactionStatus } from "@/src/lib/transactions";
import {
  getEstimatedSwapOutput,
  getSwapErrorMessage,
  swapTokens,
  type SwapToken,
} from "@/src/lib/swapTokens";

const ARC_SWAP_TOKENS: SwapToken[] = ["USDC", "EURC", "cirBTC", "BOOZZ"];
const TOKEN_REFERENCE_PRICE_USD: Record<SwapToken, number> = {
  BOOZZ: 0.3,
  cirBTC: 100000,
  EURC: 1,
  USDC: 1,
};
const DEFAULT_SLIPPAGE_PERCENT = 0.5;

function formatSwapAmount(value: number, token: SwapToken) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: token === "cirBTC" ? 8 : 6,
    minimumFractionDigits: token === "cirBTC" ? 8 : 0,
    useGrouping: false,
  });
}

export default function SwapPage() {
  const { address, login, wallet, switchToArc } = useAppWallet();
  const [tokenIn, setTokenIn] = useState<SwapToken>("USDC");
  const [tokenOut, setTokenOut] = useState<SwapToken>("EURC");
  const [amountIn, setAmountIn] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<WalletTokenBalance[]>([]);
  const estimatedOutput = getEstimatedSwapOutput(tokenIn, tokenOut, amountIn);
  const tokenInBalance =
    tokenBalances.find((token) => token.symbol === tokenIn)?.balance ?? 0;
  const numericAmountIn = Number(amountIn);
  const referenceOutput =
    Number.isFinite(numericAmountIn) && numericAmountIn > 0 && tokenIn !== tokenOut
      ? (numericAmountIn * TOKEN_REFERENCE_PRICE_USD[tokenIn]) /
        TOKEN_REFERENCE_PRICE_USD[tokenOut]
      : 0;
  const displayOutput =
    estimatedOutput ||
    (referenceOutput > 0 ? formatSwapAmount(referenceOutput, tokenOut) : "0");
  const minimumReceived =
    referenceOutput > 0
      ? formatSwapAmount(
          referenceOutput * (1 - DEFAULT_SLIPPAGE_PERCENT / 100),
          tokenOut,
        )
      : "0";
  const routeName =
    tokenIn === "USDC" && tokenOut === "BOOZZ"
      ? "BoozzFi Treasury"
      : tokenIn === "BOOZZ" || tokenOut === "BOOZZ"
        ? "Custom route unavailable"
        : "Circle App Kit";

  async function refreshBalances() {
    if (!address) {
      setTokenBalances([]);
      return;
    }

    getBalances(address)
      .then((balances) => setTokenBalances(balances.tokens))
      .catch(() => setTokenBalances([]));
  }

  useEffect(() => {
    refreshBalances();
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
        await refreshBalances();
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

      <div className={styles.defiLayout}>
        <section className={styles.defiActionCard}>
          <MinimumTransactionNotice />

          <div className={styles.swapTokenBox}>
            <div className={styles.defiTokenHeader}>
              <span>From</span>
              <strong>Balance {formatSwapAmount(tokenInBalance, tokenIn)} {tokenIn}</strong>
            </div>
            <div className={styles.defiTokenInputRow}>
              <div className={styles.defiAssetSelect}>
                <TokenIcon symbol={tokenIn} />
                <select
                  value={tokenIn}
                  onChange={(event) => setTokenIn(event.target.value as SwapToken)}
                >
                  {ARC_SWAP_TOKENS.map((token) => (
                    <option key={token} value={token}>
                      {token}
                    </option>
                  ))}
                </select>
              </div>
              <input
                inputMode="decimal"
                placeholder="0.0"
                value={amountIn}
                onChange={(event) => setAmountIn(event.target.value)}
              />
            </div>
          </div>

          <button className={styles.swapFlipButton} onClick={flipTokens} type="button">
            Flip
          </button>

          <div className={styles.swapTokenBox}>
            <div className={styles.defiTokenHeader}>
              <span>To</span>
              <strong>Estimated receive</strong>
            </div>
            <div className={styles.defiTokenInputRow}>
              <div className={styles.defiAssetSelect}>
                <TokenIcon symbol={tokenOut} />
                <select
                  value={tokenOut}
                  onChange={(event) => setTokenOut(event.target.value as SwapToken)}
                >
                  {ARC_SWAP_TOKENS.map((token) => (
                    <option key={token} value={token}>
                      {token}
                    </option>
                  ))}
                </select>
              </div>
              <output>{displayOutput}</output>
            </div>
          </div>

          <AmountPercentControls
            amount={amountIn}
            balance={tokenInBalance}
            disabled={loading}
            onSelectAmount={setAmountIn}
            symbol={tokenIn}
          />

          <button
            className={styles.primaryButton}
            onClick={handleSwap}
            disabled={loading}
          >
            {loading ? "Swapping..." : `Swap ${tokenIn} to ${tokenOut}`}
          </button>

          <TransactionProcessing
            active={loading}
            label="Waiting for the swap transaction to process..."
          />
        </section>

        <aside className={styles.defiQuotePanel}>
          <div className={styles.defiQuoteHero}>
            <span>Swap Quote</span>
            <strong className={styles.tokenHeroLine}>
              <TokenIcon size="sm" symbol={tokenOut} />
              {displayOutput} {tokenOut}
            </strong>
            <small>{routeName}</small>
          </div>
          <div className={styles.defiInfoList}>
            <div>
              <span>Rate</span>
              <strong>
                1 {tokenIn} ={" "}
                {tokenIn === tokenOut
                  ? "0"
                  : formatSwapAmount(
                      TOKEN_REFERENCE_PRICE_USD[tokenIn] /
                        TOKEN_REFERENCE_PRICE_USD[tokenOut],
                      tokenOut,
                    )}{" "}
                {tokenOut}
              </strong>
            </div>
            <div>
              <span>Minimum received</span>
              <strong>{minimumReceived} {tokenOut}</strong>
            </div>
            <div>
              <span>Slippage</span>
              <strong>{DEFAULT_SLIPPAGE_PERCENT}%</strong>
            </div>
            <div>
              <span>Price impact</span>
              <strong>{referenceOutput > 0 ? "<0.01%" : "--"}</strong>
            </div>
          </div>
        </aside>
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
