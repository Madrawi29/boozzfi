import styles from "./TransactionNotice.module.css";

type TransactionProcessingProps = {
  active: boolean;
  label: string;
};

type MinimumTransactionNoticeProps = {
  minimumUsdc?: number;
};

export function MinimumTransactionNotice({
  minimumUsdc = 1,
}: MinimumTransactionNoticeProps) {
  return (
    <p className={styles.minimumNotice}>
      Minimum {minimumUsdc} USDC is required for this transaction.
    </p>
  );
}

export function TransactionProcessing({
  active,
  label,
}: TransactionProcessingProps) {
  if (!active) return null;

  return (
    <div className={styles.processing} role="status" aria-live="polite">
      <span className={styles.blueFlame} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
