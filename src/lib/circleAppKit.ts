import { AppKit } from "@circle-fin/app-kit";

const disableErrorReporting =
  process.env.NEXT_PUBLIC_CIRCLE_DISABLE_ERROR_REPORTING === "true";

export function createCircleAppKit() {
  return new AppKit({
    disableErrorReporting,
  });
}

export function getCircleAppKitConfigStatus() {
  return {
    errorReporting: disableErrorReporting ? "disabled" : "enabled",
  };
}
