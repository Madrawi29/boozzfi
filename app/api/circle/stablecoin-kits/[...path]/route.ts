import { NextResponse } from "next/server";
import { getCircleKitKey } from "@/src/lib/arc/config";

const CIRCLE_STABLECOIN_SERVICE_BASE_URL = "https://api.circle.com/v1/stablecoinKits";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function maskAddress(address: unknown) {
  if (typeof address !== "string" || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function logStablecoinKitRequest(path: string[], body: string) {
  if (process.env.NODE_ENV === "production" || path.join("/") !== "swap") {
    return;
  }

  try {
    const payload = JSON.parse(body) as Record<string, unknown>;
    console.info("[circle-stablecoin-kit:swap]", {
      tokenInChain: payload.tokenInChain,
      tokenOutChain: payload.tokenOutChain,
      tokenInAddress: maskAddress(payload.tokenInAddress),
      tokenOutAddress: maskAddress(payload.tokenOutAddress),
      fromAddress: maskAddress(payload.fromAddress),
      toAddress: maskAddress(payload.toAddress),
      amount: payload.amount,
      slippageBps: payload.slippageBps,
    });
  } catch {
    console.info("[circle-stablecoin-kit:swap] unable to parse request body");
  }
}

async function proxyStablecoinKitRequest(request: Request, context: RouteContext) {
  const kitKey = getCircleKitKey();
  if (!kitKey) {
    return NextResponse.json(
      {
        error:
          "Circle Kit Key is not configured with a valid format. Set KIT_KEY=KIT_KEY:<keyId>:<keySecret> on the server.",
      },
      { status: 500 },
    );
  }

  const { path = [] } = await context.params;
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(
    `${CIRCLE_STABLECOIN_SERVICE_BASE_URL}/${path.join("/")}`,
  );
  targetUrl.search = incomingUrl.search;
  const requestBody = request.method === "GET" ? undefined : await request.text();

  if (requestBody) {
    logStablecoinKitRequest(path, requestBody);
  }

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("content-type") || "application/json",
      Authorization: `Bearer ${kitKey}`,
    },
    body: requestBody,
    cache: "no-store",
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/json",
    },
  });
}

export async function GET(request: Request, context: RouteContext) {
  return proxyStablecoinKitRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyStablecoinKitRequest(request, context);
}
