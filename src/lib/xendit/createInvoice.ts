type CreateXenditInvoiceInput = {
  referenceId: string;
  idrAmount: number;
};

type XenditInvoiceResponse = {
  error_code?: string;
  external_id?: string;
  id?: string;
  invoice_url?: string;
  status?: string;
  message?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured on the server.`);
  }

  return value;
}

function getBaseUrl() {
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function createXenditInvoice(input: CreateXenditInvoiceInput) {
  const secretKey = getRequiredEnv("XENDIT_SECRET_KEY");
  const auth = Buffer.from(`${secretKey}:`).toString("base64");
  const redirectUrl = `${getBaseUrl().replace(/\/$/, "")}/buy-usdc`;

  const response = await fetch("https://api.xendit.co/v2/invoices", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.idrAmount,
      currency: "IDR",
      description: "Boozz FI Buy USDC Testnet",
      external_id: input.referenceId,
      failure_redirect_url: `${redirectUrl}?payment=failed&referenceId=${encodeURIComponent(input.referenceId)}`,
      success_redirect_url: `${redirectUrl}?payment=success&referenceId=${encodeURIComponent(input.referenceId)}`,
    }),
  });

  const data = (await response.json()) as XenditInvoiceResponse;

  if (response.status === 403) {
    throw new Error(
      "Xendit API key is missing Write permission for Money-in / Invoices / Payment Links. Open Xendit Dashboard in Test Mode, create or edit a development secret key, enable Write permission for Money-in invoice/payment link access, update XENDIT_SECRET_KEY, then restart the dev server.",
    );
  }

  if (!response.ok || !data.id || !data.invoice_url) {
    throw new Error(
      data.message ||
        data.error_code ||
        "Xendit invoice creation failed.",
    );
  }

  return {
    invoiceId: data.id,
    invoiceUrl: data.invoice_url,
    status: data.status ?? "PENDING",
  };
}

export async function getXenditInvoice(invoiceId: string) {
  const secretKey = getRequiredEnv("XENDIT_SECRET_KEY");
  const auth = Buffer.from(`${secretKey}:`).toString("base64");

  const response = await fetch(
    `https://api.xendit.co/v2/invoices/${encodeURIComponent(invoiceId)}`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    },
  );

  const data = (await response.json()) as XenditInvoiceResponse;

  if (!response.ok || !data.id) {
    throw new Error(
      data.message || data.error_code || "Unable to fetch Xendit invoice.",
    );
  }

  return {
    externalId: data.external_id,
    invoiceId: data.id,
    invoiceUrl: data.invoice_url,
    status: data.status ?? "UNKNOWN",
  };
}
