import { encodeDeployData, type Abi, type Hex } from "viem";

type CircleDeployContractParams = {
  abi: Abi;
  bytecode: Hex;
  args: readonly unknown[];
};

export async function circleDeployContract(params: CircleDeployContractParams) {
  const {
    CIRCLE_API_KEY,
    CIRCLE_ENTITY_SECRET,
    CIRCLE_TREASURY_WALLET_ID,
  } = process.env;

  if (!CIRCLE_API_KEY || !CIRCLE_ENTITY_SECRET || !CIRCLE_TREASURY_WALLET_ID) {
    throw new Error("Circle env not set");
  }

  const callData = encodeDeployData({
    abi: params.abi,
    bytecode: params.bytecode,
    args: params.args,
  });

  const url = "https://api.circle.com/v1/w3s/contracts/deploy";

  const body = {
    walletId: CIRCLE_TREASURY_WALLET_ID,
    blockchain: "ARC-TESTNET",
    callData,
    to: null,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CIRCLE_API_KEY}`,
      "X-Entity-Secret": CIRCLE_ENTITY_SECRET,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(data);
    throw new Error(data?.message || "Circle deploy failed");
  }

  return data;
}
