"use client";

import { useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import { FeatureHeader } from "@/src/components/FeatureHeader";
import styles from "@/src/components/FeaturePage.module.css";
import {
  MinimumTransactionNotice,
  TransactionProcessing,
} from "@/src/components/TransactionNotice";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { getArcExplorerTxUrl } from "@/src/lib/explorers";
import { getBalances } from "@/src/lib/getBalances";
import { recordActivity, updateActivityStatus } from "@/src/lib/activity";
import { TOKENS } from "@/src/lib/tokens";
import { sendToken } from "@/src/lib/tokenTransfer";
import { waitForArcTransactionStatus } from "@/src/lib/transactions";

export default function SendPage() {
  const { address, login, wallet } = useAppWallet();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("USDC");
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
        const balances = await getBalances(address);
        setUsdcBalance(balances.usdc);
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

      <p className={styles.balanceLine}>
        USDC Balance{" "}
        <b className={styles.balanceValue}>{usdcBalance.toFixed(6)} USDC</b>
      </p>

      <div className={styles.formGrid}>
        <MinimumTransactionNotice />

        <input
          className={styles.field}
          placeholder="Recipient address"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />

        <select
          className={styles.field}
          value={selectedToken}
          onChange={(event) => setSelectedToken(event.target.value)}
        >
          {TOKENS.map((token) => (
            <option key={token.symbol} value={token.symbol}>
              {token.symbol} - {token.name}
            </option>
          ))}
        </select>

        <input
          className={styles.field}
          placeholder={`Amount ${selectedToken}`}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />

        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            onClick={handleSend}
            disabled={loading}
          >
            {loading ? "Processing..." : `Send ${selectedToken}`}
          </button>
        </div>

        <TransactionProcessing
          active={loading}
          label="Waiting for the send transaction to process..."
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
