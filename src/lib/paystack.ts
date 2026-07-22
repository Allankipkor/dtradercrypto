import axios from "axios";

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    gateway_response: string;
    currency: string;
  };
}

export function isPaystackConfigured(): boolean {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

export function isPaystackAutoConfirmEnabled(): boolean {
  return process.env.PAYSTACK_AUTO_CONFIRM === "true";
}

export function getPaystackCurrency(): string {
  return process.env.PAYSTACK_CURRENCY ?? "USD";
}

/**
 * Converts USD amount into Paystack checkout currency subunits (e.g. cents)
 */
export function convertUsdToPaystackAmount(usd: number): { amount: number; currency: string } {
  const currency = getPaystackCurrency();
  if (currency === "USD") {
    return { amount: Math.round(usd * 100), currency: "USD" };
  }
  if (currency === "KES") {
    const rate = parseFloat(process.env.USD_TO_KES ?? "130");
    return { amount: Math.round(usd * rate * 100), currency: "KES" };
  }
  // Default fallback to USD subunits (cents)
  return { amount: Math.round(usd * 100), currency: "USD" };
}

/**
 * Initializes a transaction on Paystack
 */
export async function initializePaystackTransaction(params: {
  email: string;
  amountUsd: number;
  reference: string;
}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Paystack credentials not configured (PAYSTACK_SECRET_KEY missing)");
  }

  const { amount, currency } = convertUsdToPaystackAmount(params.amountUsd);

  const payload = {
    email: params.email,
    amount,
    currency,
    reference: params.reference,
    callback_url: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/trade`,
  };

  try {
    const response = await axios.post<PaystackInitializeResponse>(
      "https://api.paystack.co/transaction/initialize",
      payload,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const resData = response.data;
    if (!resData.status || !resData.data?.authorization_url) {
      throw new Error(resData.message || "Failed to initialize Paystack transaction");
    }

    return {
      authorizationUrl: resData.data.authorization_url,
      accessCode: resData.data.access_code,
      reference: resData.data.reference,
    };
  } catch (err) {
    console.error("[paystack-initiate] API Error:", axios.isAxiosError(err) ? err.response?.data : err);
    if (axios.isAxiosError(err) && err.response?.data) {
      const errData = err.response.data as unknown;
      let detail = "Network error";
      if (typeof errData === "string") {
        detail = errData;
      } else if (errData && typeof errData === "object") {
        const obj = errData as Record<string, unknown>;
        detail = String(obj.message || obj.error || JSON.stringify(obj));
      }
      throw new Error(`Paystack API error: ${detail}`);
    }
    throw err;
  }
}

/**
 * Verifies a transaction status on Paystack
 */
export async function verifyPaystackTransaction(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Paystack credentials not configured (PAYSTACK_SECRET_KEY missing)");
  }

  try {
    const response = await axios.get<PaystackVerifyResponse>(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    const resData = response.data;
    return {
      success: resData.status && resData.data?.status === "success",
      status: resData.data?.status || "failed",
      message: resData.message,
      data: resData.data,
    };
  } catch (err) {
    console.error("[paystack-verify] API Error:", axios.isAxiosError(err) ? err.response?.data : err);
    return {
      success: false,
      status: "error",
      message: err instanceof Error ? err.message : "Error verifying Paystack payment",
    };
  }
}
