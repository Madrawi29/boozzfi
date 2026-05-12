"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeatureHeader } from "@/src/components/FeatureHeader";
import styles from "@/src/components/FeaturePage.module.css";
import { TransactionProcessing } from "@/src/components/TransactionNotice";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { getArcExplorerTxUrl } from "@/src/lib/explorers";
import type { PaymentRecord, PaymentStatus } from "@/src/types/payment";

type CreatePaymentResponse = {
  error?: string;
  message?: string;
  referenceId?: string;
  invoiceId?: string;
  invoiceUrl?: string;
  idrAmount?: number;
  usdcAmount?: string;
  status?: PaymentStatus;
};

type PaymentStatusResponse = {
  payment?: PaymentRecord;
  message?: string;
};

const STATUS_COPY: Record<PaymentStatus, string> = {
  completed: "Completed",
  failed: "Failed",
  paid: "Paid",
  pending: "Pending payment",
  sending: "Sending USDC",
};

function calculateEstimatedUsdc(idrAmount: string) {
  const value = Number(idrAmount);
  if (!Number.isFinite(value) || value <= 0) return "0";

  const usdc = (value * 6) / 100000;
  return usdc.toFixed(6).replace(/\.?0+$/, "");
}

function formatWallet(address: string | null) {
  if (!address) return "Connect wallet first";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function BuyUsdcPage() {
  const { address, authenticated, login } = useAppWallet();
  const [idrAmount, setIdrAmount] = useState("100000");
  const [referenceId, setReferenceId] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus>("pending");
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const estimatedUsdc = useMemo(
    () => calculateEstimatedUsdc(idrAmount),
    [idrAmount],
  );
  const isProcessing =
    loading || paymentStatus === "paid" || paymentStatus === "sending";
  const txHash = payment?.txHash;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextReferenceId = params.get("referenceId");
    if (nextReferenceId) {
      setReferenceId(nextReferenceId);
    }
  }, []);

  const refreshPayment = useCallback(async () => {
    if (!referenceId) return;

    try {
      const response = await fetch(
        `/api/payments/status?referenceId=${encodeURIComponent(referenceId)}`,
        { cache: "no-store" },
      );

      if (!response.ok) return;

      const data = (await response.json()) as PaymentStatusResponse;
      if (!data.payment) return;

      setPayment(data.payment);
      setPaymentStatus(data.payment.status);
      setIdrAmount(String(data.payment.idrAmount));
      if (data.payment.invoiceUrl) {
        setInvoiceUrl(data.payment.invoiceUrl);
      }

      if (data.payment.status === "completed") {
        setStatus("Payment completed. USDC transfer has been submitted.");
      } else if (data.payment.status === "sending") {
        setStatus("Payment received. Sending Arc Testnet USDC...");
      } else if (data.payment.status === "failed") {
        setStatus(data.payment.errorMessage ?? "Payment processing failed.");
      } else {
        setStatus(
          data.payment.xenditStatus
            ? `Xendit still shows ${data.payment.xenditStatus}. Open the payment link, choose a payment method, then click the red simulation banner in Xendit Test Mode.`
            : "Waiting for Xendit Test Mode payment confirmation...",
        );
      }
    } catch {
      setStatus("Unable to refresh payment status.");
    }
  }, [referenceId]);

  useEffect(() => {
    if (!referenceId) return;

    refreshPayment();
    const timer = window.setInterval(refreshPayment, 5000);
    return () => window.clearInterval(timer);
  }, [referenceId, refreshPayment]);

  const createPayment = async () => {
    try {
      if (!authenticated || !address) {
        login();
        setStatus("Connect with Privy first.");
        return;
      }

      const numericAmount = Number(idrAmount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        setStatus("Enter a valid IDR amount.");
        return;
      }

      setLoading(true);
      setStatus("Creating Xendit Test Mode payment link...");
      setPayment(null);
      setInvoiceUrl("");
      setReferenceId("");

      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idrAmount: numericAmount,
          userWallet: address,
        }),
      });

      const data = (await response.json()) as CreatePaymentResponse;

      if (!response.ok || !data.referenceId || !data.invoiceUrl) {
        throw new Error(data.message || "Payment link creation failed.");
      }

      setReferenceId(data.referenceId);
      setInvoiceUrl(data.invoiceUrl);
      setPaymentStatus(data.status ?? "pending");
      setStatus("Payment link created. Complete it in Xendit Test Mode.");
    } catch (error) {
      setPaymentStatus("failed");
      setStatus(
        error instanceof Error ? error.message : "Unable to create payment.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <FeatureHeader title="Buy USDC" />

        <p className={styles.balanceLine}>
          Connected Wallet{" "}
          <b className={styles.balanceValue}>{formatWallet(address)}</b>
        </p>

        <div className={styles.formGrid}>
          <div className={styles.noticeBox}>
            Sandbox only. Xendit Test Mode payment will send Arc Testnet USDC
            from the Circle treasury wallet after webhook confirmation. In the
            Xendit checkout page, choose a payment method and click the red
            simulation banner to complete the test payment.
          </div>

          <input
            className={styles.field}
            inputMode="numeric"
            min="1"
            placeholder="IDR amount"
            type="number"
            value={idrAmount}
            onChange={(event) => setIdrAmount(event.target.value)}
          />

          <div className={styles.estimateBox}>
            <span>Estimated Output</span>
            <strong>{estimatedUsdc} USDC</strong>
            <small>Test conversion: 100,000 IDR = 6 USDC</small>
          </div>

          <div className={styles.buttonRow}>
            <button
              className={styles.primaryButton}
              disabled={loading}
              onClick={createPayment}
            >
              {loading ? "Creating..." : "Create Payment"}
            </button>
            {invoiceUrl && (
              <a
                className={styles.secondaryLinkButton}
                href={invoiceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open Payment
              </a>
            )}
            {referenceId && (
              <button
                className={styles.secondaryButton}
                disabled={loading || paymentStatus === "sending"}
                onClick={refreshPayment}
              >
                Check Status
              </button>
            )}
          </div>

          <TransactionProcessing
            active={isProcessing}
            label={
              paymentStatus === "sending"
                ? "Waiting for Circle treasury transfer to process..."
                : "Waiting for Xendit Test Mode payment confirmation..."
            }
          />

          <div className={styles.paymentBox}>
            <div>
              <span className={styles.detailLabel}>Payment Status</span>
              <strong className={styles.detailValue}>
                {STATUS_COPY[paymentStatus]}
              </strong>
            </div>
            <div>
              <span className={styles.detailLabel}>Reference ID</span>
              <strong className={styles.detailValue}>
                {referenceId || "Not created yet"}
              </strong>
            </div>
            <div>
              <span className={styles.detailLabel}>Xendit Status</span>
              <strong className={styles.detailValue}>
                {payment?.xenditStatus ?? "Not synced yet"}
              </strong>
            </div>
            <div>
              <span className={styles.detailLabel}>Circle Tx ID</span>
              <strong className={styles.detailValue}>
                {payment?.circleTransactionId ?? "Waiting"}
              </strong>
            </div>
          </div>

          {invoiceUrl && (
            <div className={styles.qrArea}>
              <img
                alt="Xendit payment QR"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(invoiceUrl)}`}
              />
              <div>
                <span className={styles.detailLabel}>Payment Link</span>
                <a
                  className={styles.link}
                  href={invoiceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {invoiceUrl}
                </a>
              </div>
            </div>
          )}
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
