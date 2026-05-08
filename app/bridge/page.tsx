"use client";

import { useEffect, useState } from "react";
import { FeatureHeader } from "@/src/components/FeatureHeader";
import styles from "@/src/components/FeaturePage.module.css";
import {
  MinimumTransactionNotice,
  TransactionProcessing,
} from "@/src/components/TransactionNotice";
import { bridgeUsdc, type BridgeChain } from "@/src/lib/bridgeUsdc";
import { recordActivity } from "@/src/lib/activity";
import { getBridgeExplorerTxUrl } from "@/src/lib/explorers";
import { getUsdcBalance } from "@/src/lib/getBalances";
import { useAppWallet } from "@/src/hooks/useAppWallet";

const CHAINS: { label: string; value: BridgeChain }[] = [
  { label: "Ethereum Sepolia", value: "Ethereum_Sepolia" },
  { label: "Base Sepolia", value: "Base_Sepolia" },
  { label: "Arbitrum Sepolia", value: "Arbitrum_Sepolia" },
  { label: "Avalanche Fuji", value: "Avalanche_Fuji" },
  { label: "Optimism Sepolia", value: "Optimism_Sepolia" },
  { label: "Arc Testnet", value: "Arc_Testnet" },
];

const CHAIN_IDS: Record<BridgeChain, number> = {
  Ethereum_Sepolia: 11155111,
  Base_Sepolia: 84532,
  Arbitrum_Sepolia: 421614,
  Avalanche_Fuji: 43113,
  Optimism_Sepolia: 11155420,
  Arc_Testnet: 5042002,
};

function getChainLabel(chain: BridgeChain) {
  return CHAINS.find((item) => item.value === chain)?.label ?? chain;
}

function getBridgeStepChain(
  stepName: string,
  fromChain: BridgeChain,
  toChain: BridgeChain,
) {
  return stepName.toLowerCase() === "mint" ? toChain : fromChain;
}

export default function BridgePage() {
  const { authenticated, login, wallet, address } = useAppWallet();

  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [txHash, setTxHash] = useState("");
  const [txUrl, setTxUrl] = useState("");
  const [fromChain, setFromChain] = useState<BridgeChain>("Ethereum_Sepolia");
  const [toChain, setToChain] = useState<BridgeChain>("Arc_Testnet");
  const bridgeMinimumUsdc =
    fromChain === "Arc_Testnet" && toChain === "Ethereum_Sepolia" ? 2 : 1;

  const refreshBalance = async (chain = fromChain) => {
    if (!address) return;

    const nextBalance = await getUsdcBalance(address, chain);
    setBalance(nextBalance);
  };

  const handleFromChainChange = async (chain: BridgeChain) => {
    setFromChain(chain);
    await refreshBalance(chain);
  };

  useEffect(() => {
    refreshBalance();
  }, [address, fromChain]);

  const handleBridge = async () => {
    try {
      if (!authenticated || !wallet || !address) {
        login();
        setStatus("Connect with Privy first.");
        return;
      }

      if (!amount || Number(amount) <= 0) {
        setStatus("Enter a valid amount.");
        return;
      }

      if (Number(amount) < bridgeMinimumUsdc) {
        setStatus(`Minimum ${bridgeMinimumUsdc} USDC is required for this transaction.`);
        return;
      }

      if (fromChain === toChain) {
        setStatus("Choose two different chains.");
        return;
      }

      setLoading(true);
      setTxHash("");
      setTxUrl("");
      setStatus("Checking balance...");

      const usdcBalance = await getUsdcBalance(address, fromChain);
      setBalance(usdcBalance);

      if (usdcBalance < Number(amount)) {
        setStatus("Insufficient USDC.");
        return;
      }

      setStatus(`Switching Privy wallet to ${fromChain}...`);
      await wallet.switchChain(CHAIN_IDS[fromChain]);

      setStatus("");
      const result = await bridgeUsdc(amount, fromChain, toChain, wallet);

      await refreshBalance(fromChain);

      const burnStep = result.steps.find((step) => step.name === "burn");
      const firstTxStep = result.steps.find((step) => step.txHash);
      const failedStep = result.steps.find((step) => step.state === "error");
      const primaryTxHash = burnStep?.txHash ?? firstTxStep?.txHash;
      const bridgeStatus = result.state === "success"
        ? "Success"
        : failedStep
          ? "Failed"
          : "Pending";

      if (primaryTxHash) {
        setTxHash(primaryTxHash);
        setTxUrl(
          burnStep?.explorerUrl ??
            firstTxStep?.explorerUrl ??
            getBridgeExplorerTxUrl(fromChain, primaryTxHash),
        );
      }

      const bridgeStepsWithTx = result.steps.filter((step) => step.txHash);

      if (bridgeStepsWithTx.length > 0) {
        await Promise.all(
          bridgeStepsWithTx.map((step) => {
            const stepChain = getBridgeStepChain(step.name, fromChain, toChain);
            const stepStatus =
              step.state === "error"
                ? "Failed"
                : result.state === "success"
                  ? "Success"
                  : "Pending";

            return recordActivity({
              walletAddress: address,
              type: "Bridge",
              asset: `USDC bridge ${step.name} on ${getChainLabel(stepChain)} (${getChainLabel(fromChain)} to ${getChainLabel(toChain)})`,
              amount: Number(amount),
              status: stepStatus,
              txHash: step.txHash,
            });
          }),
        );
      } else {
        await recordActivity({
          walletAddress: address,
          type: "Bridge",
          asset: `USDC ${getChainLabel(fromChain)} to ${getChainLabel(toChain)}`,
          amount: Number(amount),
          status: bridgeStatus,
        });
      }

      if (result.state === "success") {
        setStatus("Bridge submitted.");
        return;
      }
      setStatus(
        failedStep?.errorMessage ??
          "Bridge did not complete. Check the wallet for another confirmation.",
      );
    } catch (error) {
      console.error(error);
      if (address) {
        await recordActivity({
          walletAddress: address,
          type: "Bridge",
          asset: `USDC ${getChainLabel(fromChain)} to ${getChainLabel(toChain)}`,
          amount: Number(amount) || 0,
          status: "Failed",
        });
      }
      setStatus(error instanceof Error ? error.message : "Bridge failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
      <FeatureHeader title="Bridge USDC" />

      <p className={styles.balanceLine}>
        USDC Balance{" "}
        <b className={styles.balanceValue}>{balance.toFixed(6)} USDC</b>
      </p>

      <div className={styles.formGrid}>
        <MinimumTransactionNotice minimumUsdc={bridgeMinimumUsdc} />

        <select
          className={styles.field}
          value={fromChain}
          onChange={(event) =>
            handleFromChainChange(event.target.value as BridgeChain)
          }
        >
          {CHAINS.map((chain) => (
            <option key={chain.value} value={chain.value}>
              From: {chain.label}
            </option>
          ))}
        </select>

        <select
          className={styles.field}
          value={toChain}
          onChange={(event) => setToChain(event.target.value as BridgeChain)}
        >
          {CHAINS.map((chain) => (
            <option key={chain.value} value={chain.value}>
              To: {chain.label}
            </option>
          ))}
        </select>

        <input
          className={styles.field}
          placeholder="Amount USDC"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />

        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            onClick={handleBridge}
            disabled={loading}
          >
            {loading ? "Processing..." : "Bridge"}
          </button>

          <button
            className={styles.secondaryButton}
            onClick={() => refreshBalance()}
            disabled={!wallet || loading}
          >
            Refresh
          </button>
        </div>

        <TransactionProcessing
          active={loading}
          label="Waiting for the bridge transaction to process..."
        />
      </div>

      {status && <p className={styles.statusText}>{status}</p>}

      {txHash && txUrl && (
        <p className={styles.txLine}>
          Tx:{" "}
          <a className={styles.link} href={txUrl} rel="noreferrer" target="_blank">
            View transaction
          </a>
        </p>
      )}
      </section>
    </main>
  );
}
