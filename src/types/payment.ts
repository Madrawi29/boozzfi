export type PaymentStatus =
  | "pending"
  | "paid"
  | "sending"
  | "completed"
  | "failed";

export type PaymentRecord = {
  referenceId: string;
  invoiceId?: string;
  invoiceUrl?: string;
  userWallet: string;
  idrAmount: number;
  usdcAmount: string;
  status: PaymentStatus;
  xenditStatus?: string;
  circleTransactionId?: string;
  txHash?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};
