import axios from "axios";

/**
 * Format Zambian phone number to 10-digit local format: 0XXXXXXXXX
 * Standard mobile prefixes in Zambia include 097, 096, 095, 077, 076.
 */
export function formatZambianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("260") && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `260${digits.slice(1)}`;
  }
  if (digits.length === 9 && !digits.startsWith("260")) {
    return `260${digits}`;
  }
  return digits;
}

interface MoneyUnifyInitiateResponse {
  message?: string;
  data?: {
    status?: string;
    amount?: number;
    transaction_id?: string;
    charges?: number;
    from_payer?: string;
  };
  isError?: boolean;
}

interface MoneyUnifyVerifyResponse {
  message?: string;
  data?: {
    status?: string;
    amount?: string | number;
    transaction_id?: string;
    charges?: string | number;
    from_payer?: string;
  };
  isError?: boolean;
}

/**
 * INITIATE MONEYUNIFY PAYMENT (Request to Pay)
 * POST https://api.moneyunify.one/payments/request
 * Content-Type: application/x-www-form-urlencoded
 */
export async function initiateMoneyUnifyPayment(params: {
  phone: string;
  amountZmw: number;
}) {
  const authId = process.env.MONEYUNIFY_AUTH_ID;
  if (!authId) {
    throw new Error("MoneyUnify credentials not configured (MONEYUNIFY_AUTH_ID missing)");
  }

  const formattedPhone = formatZambianPhone(params.phone);
 
  try {
    const response = await axios.post<MoneyUnifyInitiateResponse>(
      "https://api.moneyunify.one/payments/request",
      {
        from_payer: formattedPhone,
        amount: params.amountZmw,
        auth_id: authId,
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    const responseData = response.data;
    if (responseData.isError === true) {
      throw new Error(responseData.message || "MoneyUnify payment initiation failed");
    }

    const data = responseData.data;
    if (!data || !data.transaction_id) {
      throw new Error(responseData.message || "Failed to retrieve transaction ID from MoneyUnify");
    }

    return {
      transactionId: data.transaction_id,
      status: data.status || "initiated",
      message: responseData.message || "Transaction initiated successfully",
      charges: data.charges ?? 0,
    };
  } catch (err) {
    console.error("[moneyunify-initiate] API Error:", axios.isAxiosError(err) ? err.response?.data : err);
    if (axios.isAxiosError(err) && err.response?.data) {
      const errData = err.response.data as unknown;
      let detail = "Network error";
      if (typeof errData === "string") {
        detail = errData;
      } else if (errData && typeof errData === "object") {
        const obj = errData as Record<string, unknown>;
        detail = String(obj.message || obj.error || JSON.stringify(obj));
      }
      throw new Error(`MoneyUnify: ${detail}`);
    }
    throw err;
  }
}

/**
 * VERIFY MONEYUNIFY PAYMENT STATUS
 * POST https://api.moneyunify.one/payments/verify
 * Content-Type: application/json
 */
export async function verifyMoneyUnifyPayment(moneyUnifyTxId: string) {
  const authId = process.env.MONEYUNIFY_AUTH_ID;
  if (!authId) {
    throw new Error("MoneyUnify credentials not configured (MONEYUNIFY_AUTH_ID missing)");
  }

  const response = await axios.post<MoneyUnifyVerifyResponse>(
    "https://api.moneyunify.one/payments/verify",
    {
      auth_id: authId,
      transaction_id: moneyUnifyTxId,
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    }
  );

  const data = response.data;
  return {
    success: response.status === 200 && data.isError !== true,
    message: data.message,
    data: data.data,
  };
}

/**
 * USD → ZMW conversion
 */
export function usdToZmw(usd: number): number {
  const rate = parseFloat(process.env.USD_TO_ZMW ?? "26");
  return Math.ceil(usd * rate);
}

/**
 * Configuration Check
 */
export function isMoneyUnifyConfigured(): boolean {
  return !!process.env.MONEYUNIFY_AUTH_ID;
}

export function isMoneyUnifyAutoConfirmEnabled(): boolean {
  return process.env.MONEYUNIFY_AUTO_CONFIRM === "true";
}
