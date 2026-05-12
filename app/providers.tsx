"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { AppWalletProvider } from "@/src/providers/AppWalletProvider";
import { arcTestnetChain } from "@/src/lib/arc/viem";
import { DisplayModeToggle } from "@/src/components/DisplayModeToggle";
import {
  arbitrumSepolia,
  avalancheFuji,
  baseSepolia,
  optimismSepolia,
  sepolia,
} from "viem/chains";

type PrivyConfig = NonNullable<
  React.ComponentProps<typeof PrivyProvider>["config"]
>;

const PRIVY_LOGIN_METHODS: NonNullable<PrivyConfig["loginMethods"]> = [
  "wallet",
  "email",
  "google",
  "twitter",
  "discord",
  "telegram",
  "instagram",
  "tiktok",
];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        supportedChains: [
          arcTestnetChain,
          sepolia,
          baseSepolia,
          arbitrumSepolia,
          avalancheFuji,
          optimismSepolia,
        ],
        defaultChain: arcTestnetChain,
        loginMethods: PRIVY_LOGIN_METHODS,
        allowOAuthInEmbeddedBrowsers: true,
        appearance: {
          walletChainType: "ethereum-only",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "all-users",
          },
          solana: {
            createOnLogin: "off",
          },
        },
      }}
    >
      <AppWalletProvider>
        {children}
        <DisplayModeToggle />
      </AppWalletProvider>
    </PrivyProvider>
  );
}
