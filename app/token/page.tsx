"use client";

import { useState } from "react";
import { isAddress, type Address } from "viem";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { TOKENS, type Token } from "@/src/lib/tokens";
import { sendToken } from "@/src/lib/tokenTransfer";

export default function TokenPage() {
  const { ready, authenticated, login, wallet, shortAddress } = useAppWallet();
  const [selectedToken, setSelectedToken] = useState(TOKENS[0].symbol);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  const token = TOKENS.find((item: Token) => item.symbol === selectedToken)!;

  async function handleSend() {
    try {
      if (!wallet) {
        login();
        setStatus("Connect with Privy first.");
        return;
      }
      if (!isAddress(recipient)) {
        setStatus("Enter a valid recipient address.");
        return;
      }

      setStatus(`Sending ${token.symbol}...`);
      const tx = await sendToken(
        token.address,
        recipient as Address,
        amount,
        token.decimals,
        wallet,
      );

      setStatus(`Sent: ${tx}`);
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Send failed.");
    }
  }

  return (
    <main style={{ padding: 32 }}>
      <h1>Send Token</h1>

      {!authenticated ? (
        <button
          onClick={() => login()}
          disabled={!ready}
          style={{ marginBottom: 12 }}
        >
          {ready ? "Login with Privy" : "Loading Privy..."}
        </button>
      ) : (
        <p>
          Wallet: <b>{shortAddress ?? "Wallet loading..."}</b>
        </p>
      )}

      <select
        value={selectedToken}
        onChange={(event) => setSelectedToken(event.target.value)}
        style={{ display: "block", marginBottom: 12, padding: 10, width: 420 }}
      >
        {TOKENS.map((item: Token) => (
          <option key={item.address} value={item.symbol}>
            {item.symbol} - {item.name}
          </option>
        ))}
      </select>

      <input
        placeholder="Recipient Wallet Address"
        value={recipient}
        onChange={(event) => setRecipient(event.target.value)}
        style={{ display: "block", marginBottom: 12, padding: 10, width: 420 }}
      />

      <input
        placeholder={`Amount ${token.symbol}`}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        style={{ display: "block", marginBottom: 12, padding: 10, width: 420 }}
      />

      <button onClick={handleSend}>Send {token.symbol}</button>

      <p>{status}</p>
    </main>
  );
}
