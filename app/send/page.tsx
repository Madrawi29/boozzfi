"use client";

import { useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import { FeatureHeader } from "@/src/components/FeatureHeader";
import styles from "@/src/components/FeaturePage.module.css";
import { AmountPercentControls } from "@/src/components/TokenBalanceControls";
import {
  isTokenIconSymbol,
  TokenIcon,
  type TokenIconSymbol,
} from "@/src/components/TokenIcon";
import {
  MinimumTransactionNotice,
  TransactionProcessing,
} from "@/src/components/TransactionNotice";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { getArcExplorerTxUrl } from "@/src/lib/explorers";
import { getBalances, type WalletTokenBalance } from "@/src/lib/getBalances";
import { recordActivity, updateActivityStatus } from "@/src/lib/activity";
import { TOKENS } from "@/src/lib/tokens";
import { sendToken } from "@/src/lib/tokenTransfer";
import { waitForArcTransactionStatus } from "@/src/lib/transactions";

function formatTokenAmount(value: number, symbol: string) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: symbol === "cirBTC" ? 8 : 6,
    minimumFractionDigits: symbol === "cirBTC" ? 8 : 2,
  });
}

function shortenAddress(value: string) {
  if (!isAddress(value)) return "Not ready";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function SendPage() {
  const { address, login, wallet } = useAppWallet();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("USDC");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<WalletTokenBalance[]>([]);
  const selectedTokenBalance =
    tokenBalances.find((token) => token.symbol === selectedToken)?.balance ?? 0;
  const recipientIsValid = isAddress(to);
  const numericAmount = Number(amount);
  const amountIsValid = Number.isFinite(numericAmount) && numericAmount > 0;
  const selectedTokenIcon: TokenIconSymbol = isTokenIconSymbol(selectedToken)
    ? selectedToken
    : "USDC";

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

  const handleSend = async () => {
    try {
      if (!wallet) {
        login();
        setStatus("Connect with Privy first.");
        return;
      }
      if (!isAddress(to)) {
        setStatus("Enter a valid recipient address.");
        return;
      }
      if (!amount || Number(amount) <= 0) {
        setStatus("Enter a valid amount.");
        return;
      }

      const token = TOKENS.find((item) => item.symbol === selectedToken);
      if (!token) throw new Error("Unsupported token selected");

      setLoading(true);
      setStatus(`Sending ${selectedToken}...`);
      const hash = await sendToken(
        token.address,
        to as Address,
        amount,
        token.decimals,
        wallet,
      );

      setTxHash(hash);
      await recordActivity({
        walletAddress: wallet.address,
        type: "Send",
        asset: `${selectedToken} on Arc Testnet`,
        amount: Number(amount),
        status: "Pending",
        txHash: hash,
      });
      setStatus("Send submitted. Waiting for confirmation...");
      const activityStatus = await waitForArcTransactionStatus(hash);
      await updateActivityStatus(hash, activityStatus);
      if (address) {
        await refreshBalances();
      }
      setStatus(
        activityStatus === "Success"
          ? "Send confirmed."
          : "Send transaction failed.",
      );
    } catch (error) {
      console.error(error);
      if (wallet) {
        await recordActivity({
          walletAddress: wallet.address,
          type: "Send",
          asset: `${selectedToken} on Arc Testnet`,
          amount: Number(amount) || 0,
          status: "Failed",
        });
      }
      setStatus(error instanceof Error ? error.message : "Send failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
      <FeatureHeader title="Send Token" />

      <div className={styles.defiLayout}>
        <section className={styles.defiActionCard}>
          <MinimumTransactionNotice />

          <label className={styles.defiFieldGroup}>
            <span>Recipient</span>
            <input
              placeholder="0x recipient address"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
            <small className={recipientIsValid ? styles.defiPositive : styles.defiMuted}>
              {recipientIsValid ? "Valid EVM address" : "Paste a valid wallet address"}
            </small>
          </label>

          <div className={styles.swapTokenBox}>
            <div className={styles.defiTokenHeader}>
              <span>Asset</span>
              <strong>
                Balance {formatTokenAmount(selectedTokenBalance, selectedToken)} {selectedToken}
              </strong>
            </div>
            <div className={styles.defiTokenInputRow}>
              <div className={styles.defiAssetSelect}>
                <TokenIcon symbol={selectedTokenIcon} />
                <select
                  value={selectedToken}
                  onChange={(event) => setSelectedToken(event.target.value)}
                >
                  {TOKENS.map((token) => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <input
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </div>

          <AmountPercentControls
            amount={amount}
            balance={selectedTokenBalance}
            disabled={loading}
            onSelectAmount={setAmount}
            symbol={selectedToken}
          />

          <button
            className={styles.primaryButton}
            onClick={handleSend}
            disabled={loading}
          >
            {loading ? "Processing..." : `Send ${selectedToken}`}
          </button>

          <TransactionProcessing
            active={loading}
            label="Waiting for the send transaction to process..."
          />
        </section>

        <aside className={styles.defiQuotePanel}>
          <div className={styles.defiQuoteHero}>
            <span>Transfer Review</span>
            <strong className={styles.tokenHeroLine}>
              <TokenIcon size="sm" symbol={selectedTokenIcon} />
              {amountIsValid ? formatTokenAmount(numericAmount, selectedToken) : "0.00"} {selectedToken}
            </strong>
            <small>Arc Testnet transfer</small>
          </div>
          <div className={styles.defiInfoList}>
            <div>
              <span>Recipient</span>
              <strong>{shortenAddress(to)}</strong>
            </div>
            <div>
              <span>Network</span>
              <strong>Arc Testnet</strong>
            </div>
            <div>
              <span>Estimated fee</span>
              <strong>USDC gas</strong>
            </div>
            <div>
              <span>Balance after</span>
              <strong>
                {formatTokenAmount(
                  Math.max(0, selectedTokenBalance - (amountIsValid ? numericAmount : 0)),
                  selectedToken,
                )}{" "}
                {selectedToken}
              </strong>
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
