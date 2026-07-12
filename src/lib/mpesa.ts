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

interface PayheroInitiateResponse {
  status?: string;
  success?: boolean;
  message?: string;
  transaction_id?: string;
  Reference?: string;
  CheckoutRequestID?: string;
  checkout_request_id?: string;
}

interface PayheroStatusResponse {
  status?: string;
  Status?: string;
  mpesa_receipt_number?: string;
  MpesaReceiptNumber?: string;
  mpesaReceiptNumber?: string;
  checkout_request_id?: string;
  CheckoutRequestID?: string;
  merchant_request_id?: string;
  MerchantRequestID?: string;
  phone_number?: string;
  PhoneNumber?: string;
  Phone?: string;
  message?: string;
  ResultDesc?: string;
  ResultDescription?: string;
}

/**
 * INITIATE PAYHERO STK PUSH
 * POST https://backend.payhero.co.ke/api/v2/payments
 * Auth: Basic auth using PAYHERO_API_USERNAME and PAYHERO_API_PASSWORD
 */
export async function initiateStkPush(params: {
  phone: string;
  amountKes: number;
  accountReference: string;
  transactionDesc: string;
}) {
  const username = process.env.PAYHERO_API_USERNAME;
  const password = process.env.PAYHERO_API_PASSWORD;
  const channelId = process.env.PAYHERO_CHANNEL_ID;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  if (!username || !password || !channelId) {
    throw new Error("Payhero credentials not configured");
  }

  if (!callbackUrl) {
    throw new Error("MPESA_CALLBACK_URL not configured");
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const externalReference = params.accountReference?.slice(0, 32) ?? "DTRADERCRYPTO";

  let response;
  try {
    response = await axios.post<PayheroInitiateResponse>(
      "https://backend.payhero.co.ke/api/v2/payments/initiate-stk-push",
      {
        amount: Math.ceil(params.amountKes),
        phone_number: formatPhone(params.phone),
        channel_id: parseInt(channelId, 10),
        provider: "m-pesa",
        external_reference: externalReference,
        callback_url: callbackUrl,
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("[payhero-stk-push] API Error:", axios.isAxiosError(err) ? err.response?.data : err);
    if (axios.isAxiosError(err) && err.response?.data) {
      const data = err.response.data as any;
      const detail = typeof data === "string" ? data : (data.message || data.status || data.error || JSON.stringify(data));
      throw new Error(`PayHero: ${detail}`);
    }
    throw err;
  }

  const responseData = response.data;
  const success = responseData.status === "success" || responseData.success === true;
  
  if (!success) {
    throw new Error(responseData.message || "STK push failed");
  }

  const transactionId = String(responseData.transaction_id || responseData.Reference || responseData.CheckoutRequestID || externalReference);
  const checkoutRequestId = String(responseData.checkout_request_id || responseData.CheckoutRequestID || transactionId);

  return {
    transactionId,
    checkoutRequestId,
    merchantRequestId: checkoutRequestId,
    status: "pending",
    CustomerMessage: responseData.message || "Request accepted for processing",
  };
}

/**
 * CHECK STK PUSH STATUS
 * GET https://backend.payhero.co.ke/api/v2/transaction-status?reference={ref}
 */
export async function checkStkStatus(checkoutRequestId: string) {
  const username = process.env.PAYHERO_API_USERNAME;
  const password = process.env.PAYHERO_API_PASSWORD;

  if (!username || !password) {
    throw new Error("Payhero credentials not configured");
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const response = await axios.get<PayheroStatusResponse>(
    "https://backend.payhero.co.ke/api/v2/transaction-status",
    {
      params: { reference: checkoutRequestId },
      headers: {
        Authorization: `Basic ${auth}`,
      },
      validateStatus: () => true,
    }
  );

  const data = response.data;
  const status = data.status || data.Status || "Pending";
  const normalizedStatus = status.toLowerCase() === "success" ? "Success" : (status.toLowerCase() === "failed" ? "Failed" : "Pending");
  
  return {
    success: response.status === 200 && (status.toLowerCase() === "success" || status.toLowerCase() === "pending"),
    data: {
      response: {
        Status: normalizedStatus,
        MpesaReceiptNumber: data.mpesa_receipt_number || data.MpesaReceiptNumber || data.mpesaReceiptNumber || "",
        CheckoutRequestID: data.checkout_request_id || data.CheckoutRequestID || checkoutRequestId,
        MerchantRequestID: data.merchant_request_id || data.MerchantRequestID || checkoutRequestId,
        Phone: data.phone_number || data.PhoneNumber || data.Phone || "",
        ResultDesc: data.message || data.ResultDesc || data.ResultDescription || "",
      }
    }
  };
}

/**
 * USD → KES conversion
 */
export function usdToKes(usd: number): number {
  const rate = parseFloat(process.env.USD_TO_KES ?? "130");
  return Math.ceil(usd * rate);
}

/**
 * Check if Payhero M-Pesa is configured
 */
export function isMpesaConfigured(): boolean {
  return !!(process.env.PAYHERO_API_USERNAME && process.env.PAYHERO_API_PASSWORD && process.env.PAYHERO_CHANNEL_ID);
}

export function isMpesaAutoConfirmEnabled(): boolean {
  return process.env.MPESA_AUTO_CONFIRM === "true";
}