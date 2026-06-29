import axios from "axios";

/**
 * Format Kenyan phone number to 2547XXXXXXXX
 */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7")) return `254${digits}`;
  return digits;
}

const LIPIA_BASE_URL = process.env.LIPIA_BASE_URL ?? "https://lipia-api.kreativelabske.com/api/v2";

interface LipiaStkResponse {
  success: boolean;
  message?: string;
  customerMessage?: string;
  data: {
    TransactionReference: string;
    MerchantRequestID?: string;
    CheckoutRequestID?: string;
    [key: string]: unknown;
  };
}

/**
 * INITIATE LIPIA ONLINE STK PUSH
 *
 * Per Lipia's docs: POST {LIPIA_BASE_URL}/payments/stk-push
 * Auth: Authorization: Bearer {LIPIA_API_KEY}
 *
 * Request body:
 * {
 *   "phone_number": "254712345678",
 *   "amount": 100,
 *   "external_reference": "order_123",
 *   "callback_url": "https://your-domain.com/api/payments/callback",
 *   "metadata": { ... }
 * }
 */
export async function initiateStkPush(params: {
  phone: string;
  amountKes: number;
  accountReference: string;
  transactionDesc: string;
}) {
  const apiKey = process.env.LIPIA_API_KEY;
  if (!apiKey) {
    throw new Error("Lipia Online credentials not configured");
  }

  const callbackUrl = process.env.MPESA_CALLBACK_URL;
  if (!callbackUrl) {
    throw new Error("MPESA_CALLBACK_URL not configured");
  }

  const externalReference = params.accountReference?.slice(0, 32) ?? "DTRADERCRYPTO";

  let response;
  try {
    response = await axios.post<LipiaStkResponse>(
      `${LIPIA_BASE_URL}/payments/stk-push`,
      {
        phone_number: formatPhone(params.phone),
        amount: Math.ceil(params.amountKes),
        external_reference: externalReference,
        callback_url: callbackUrl,
        metadata: {
          description: params.transactionDesc?.slice(0, 50) ?? "Deposit",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    // Lipia returns its error body (with `message`/`customerMessage`) on
    // non-2xx responses too — surface that instead of a generic axios error.
    if (axios.isAxiosError(err) && err.response?.data) {
      const data = err.response.data as Partial<LipiaStkResponse>;
      throw new Error(data.customerMessage || data.message || "STK push failed");
    }
    throw err;
  }

  if (!response.data.success) {
    throw new Error(response.data.customerMessage || response.data.message || "STK push failed");
  }

  // Normalize to the field names the rest of our app expects (set by the old
  // GravityPay integration), so callers (deposit route, status polling)
  // don't need to know Lipia's exact shape.
  return {
    transactionId: response.data.data.TransactionReference,
    checkoutRequestId: response.data.data.CheckoutRequestID ?? response.data.data.TransactionReference,
    merchantRequestId: response.data.data.MerchantRequestID ?? response.data.data.TransactionReference,
    status: "pending",
    CustomerMessage: response.data.customerMessage ?? response.data.message ?? "Request accepted for processing",
  };
}

interface LipiaStatusResponse {
  success: boolean;
  message?: string;
  customerMessage?: string;
  data?: {
    response: {
      Amount: number;
      ExternalReference: string;
      MerchantRequestID: string;
      CheckoutRequestID: string;
      MpesaReceiptNumber: string;
      Phone: string;
      ResultCode: number;
      ResultDesc: string;
      Metadata?: Record<string, unknown>;
      Status: "Success" | "Failed" | "Pending" | string;
    };
  };
}

/**
 * CHECK STK PUSH STATUS — used for polling fallback while webhooks are
 * unreliable. Pass the TransactionReference (called checkoutRequestId by
 * callers, for compatibility with the old GravityPay naming) returned by
 * initiateStkPush.
 *
 * Per Lipia's docs: GET {LIPIA_BASE_URL}/payments/status?reference={ref}
 */
export async function checkStkStatus(checkoutRequestId: string): Promise<LipiaStatusResponse> {
  const apiKey = process.env.LIPIA_API_KEY;
  if (!apiKey) {
    throw new Error("Lipia Online credentials not configured");
  }

  const response = await axios.get<LipiaStatusResponse>(
    `${LIPIA_BASE_URL}/payments/status`,
    {
      params: { reference: checkoutRequestId },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      validateStatus: () => true, // we want to inspect 404/error bodies ourselves
    }
  );

  return response.data;
}

/**
 * USD → KES conversion
 */
export function usdToKes(usd: number): number {
  const rate = parseFloat(process.env.USD_TO_KES ?? "130");
  return Math.ceil(usd * rate);
}

/**
 * Check if Lipia Online is configured
 */
export function isMpesaConfigured(): boolean {
  return !!process.env.LIPIA_API_KEY;
}