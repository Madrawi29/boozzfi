import { ARC_TESTNET } from "@/src/lib/arc/config";

export function getUnifiedBalanceStatus() {
  return {
    token: "USDC",
    network: ARC_TESTNET.name,
    gatewayMode: "testnet",
    balances: [
      { location: "wallet", chain: "Arc Testnet", amount: "48,250.00", status: "available" },
      { location: "gateway", chain: "Unified Balance", amount: "3,500.00", status: "deposit-ready" },
      { location: "lp", chain: "Arc Testnet", amount: "15,742.72", status: "locked-in-position" },
      { location: "vault", chain: "Arc Testnet", amount: "7,412.18", status: "vault-share" }
    ],
    flowStatuses: [
      { step: "GATEWAY_DEPOSIT", status: "DRAFT" },
      { step: "ATTESTATION", status: "DRAFT" },
      { step: "DESTINATION_SPEND", status: "DRAFT" }
    ],
    disclosure: "Unified balance and Gateway flows are testnet-only in this prototype."
  };
}
