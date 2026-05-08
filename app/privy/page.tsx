"use client";

import { useAppWallet } from "@/src/hooks/useAppWallet";

export default function PrivyTestPage() {
  const {
    ready,
    authenticated,
    login,
    logout,
    user,
    wallets,
    wallet,
    shortAddress,
    chainId,
  } = useAppWallet();

  if (!ready) {
    return <main style={{ padding: 32 }}>Loading Privy...</main>;
  }

  return (
    <main style={{ padding: 32 }}>
      <h1>Privy Wallet State</h1>

      {!authenticated ? (
        <button onClick={login}>Login with Privy</button>
      ) : (
        <>
          <button onClick={logout}>Logout</button>
          <p>User ID: {user?.id}</p>
          <p>Active wallet: {shortAddress ?? "No EVM wallet"}</p>
          <p>Chain ID: {chainId ?? "Unknown"}</p>

          <h3>Wallets</h3>
          {wallets.map((connectedWallet) => (
            <p key={connectedWallet.address}>
              {connectedWallet.walletClientType}: {connectedWallet.address}
              {wallet?.address === connectedWallet.address ? " (active)" : ""}
            </p>
          ))}
        </>
      )}
    </main>
  );
}
