import { SERVER_SECRET_READINESS } from "@/src/lib/arc/config";

export type ManagedWalletOperation =
  | "CREATE_WALLET_SET"
  | "CREATE_WALLET"
  | "TRANSFER"
  | "EXECUTE_CONTRACT"
  | "DEPLOY_CONTRACT";

export function getCircleManagedWalletReadiness() {
  const ready = SERVER_SECRET_READINESS.CIRCLE_API_KEY && SERVER_SECRET_READINESS.CIRCLE_ENTITY_SECRET;
  return {
    ready,
    mode: "server_only",
    apiKeyConfigured: SERVER_SECRET_READINESS.CIRCLE_API_KEY,
    entitySecretConfigured: SERVER_SECRET_READINESS.CIRCLE_ENTITY_SECRET,
    web3ApiKeyConfigured: SERVER_SECRET_READINESS.CIRCLE_WEB3_API_KEY,
    secretsExposedToFrontend: false,
    requirements: [
      "CIRCLE_API_KEY must be configured server-side",
      "CIRCLE_ENTITY_SECRET must be configured server-side or loaded from a secret manager",
      "Entity Secret ciphertext must be generated per Circle operation",
      "Recovery file must be stored outside the repository"
    ]
  };
}

export function assertManagedWalletReady(operation: ManagedWalletOperation) {
  const readiness = getCircleManagedWalletReadiness();
  if (!readiness.ready) {
    return {
      ok: false,
      operation,
      status: "CONFIGURATION_REQUIRED",
      message: "Managed wallet operation is blocked until Circle server-side credentials and Entity Secret are configured."
    };
  }

  return {
    ok: true,
    operation,
    status: "READY",
    message: "Server-side managed wallet credentials are configured. Implement the Circle SDK operation in this boundary."
  };
}
