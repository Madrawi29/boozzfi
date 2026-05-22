import { AppKit } from "@circle-fin/app-kit";
import { installCircleFetchProxy } from "@/src/lib/circleFetchProxy";

const disableErrorReporting =
  process.env.NEXT_PUBLIC_CIRCLE_DISABLE_ERROR_REPORTING === "true";

export function createCircleAppKit() {
  installCircleFetchProxy();

  return new AppKit({
    disableErrorReporting,
  });
}

export function getCircleAppKitConfigStatus() {
  return {
    errorReporting: disableErrorReporting ? "disabled" : "enabled",
  };
}
