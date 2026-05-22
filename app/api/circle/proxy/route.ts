import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_CIRCLE_HOSTS = new Set([
  "gateway-api.circle.com",
  "gateway-api-testnet.circle.com",
  "iris-api.circle.com",
  "iris-api-sandbox.circle.com",
]);

function getTargetUrl(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("url");
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!ALLOWED_CIRCLE_HOSTS.has(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function proxyCircleRequest(request: NextRequest) {
  const targetUrl = getTargetUrl(request);
  if (!targetUrl) {
    return NextResponse.json(
      { error: "bad_request", message: "Circle proxy target is not allowed." },
      { status: 400 },
    );
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("content-type") || "application/json",
      "X-User-Agent":
        request.headers.get("x-user-agent") ||
        request.headers.get("user-agent") ||
        "boozzfi",
    },
    body,
    cache: "no-store",
  });

  const responseBody = await response.text();
  return new Response(responseBody, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}

export async function GET(request: NextRequest) {
  return proxyCircleRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyCircleRequest(request);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
