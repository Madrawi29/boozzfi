export type ActivityStatus = "Pending" | "Success" | "Failed";

export type RecordActivityInput = {
  walletAddress?: string;
  type: string;
  asset: string;
  amount: number;
  status: ActivityStatus;
  txHash?: string;
};

export async function recordActivity(input: RecordActivityInput) {
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input,
        feeUsd: 0,
        txHash:
          input.txHash ||
          `${input.status.toLowerCase()}-${input.type.toLowerCase()}-${Date.now()}`,
      }),
    });
  } catch (error) {
    console.warn("Activity recording failed", error);
  }
}

export async function updateActivityStatus(
  txHash: string,
  status: ActivityStatus,
) {
  try {
    await fetch("/api/activity", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txHash, status }),
    });
  } catch (error) {
    console.warn("Activity status update failed", error);
  }
}
