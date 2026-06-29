// PayPal REST API integration (Orders v2 API + OAuth client-credentials).
// Used by the "card" tab in DepositModal — PayPal's hosted button covers
// both PayPal-balance payments and debit/credit cards in one integration,
// so this single backend handles both.

const PAYPAL_API_BASE = process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export function isPaypalConfigured(): boolean {
    return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Exchanges our client ID + secret for a short-lived OAuth access token,
 * caching it in memory until shortly before it expires. The secret never
 * leaves the server — only the resulting token (and only the front-end's
 * own public clientId, separately) is ever exposed to the browser.
 */
async function getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
        return cachedToken.value;
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !secret) {
        throw new Error("PayPal not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env");
    }

    const basicAuth = Buffer.from(`${clientId}:${secret}`).toString("base64");
    const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`PayPal OAuth failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    // Refresh a little early (60s buffer) rather than risk using a token that
    // expires mid-request.
    cachedToken = {
        value: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return cachedToken.value;
}

export interface CreateOrderResult {
    id: string;
}

/**
 * Creates a PayPal order for the given USD amount. The amount lives only on
 * the server — the browser never gets to specify or tamper with it; the
 * front-end only ever receives back the order ID to hand to the PayPal
 * button's approval flow.
 *
 * If PAYPAL_PAYEE_EMAIL is set, funds settle into THAT PayPal account
 * instead of the one tied to PAYPAL_CLIENT_ID/SECRET — this is the standard
 * "platform/developer builds for merchant" pattern: our app's credentials
 * process the payment, but a different account (the merchant of record)
 * actually receives the money. PayPal requires that account to have granted
 * consent to our Client ID beforehand; without it, PayPal returns an
 * explicit "payee does not have appropriate consent" error rather than
 * silently failing or sending funds anywhere unintended.
 */
export async function createPaypalOrder(params: {
    amount: number;
    referenceId: string;
}): Promise<CreateOrderResult> {
    const token = await getAccessToken();
    const payeeEmail = process.env.PAYPAL_PAYEE_EMAIL;

    const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
                {
                    reference_id: params.referenceId,
                    amount: {
                        currency_code: "USD",
                        value: params.amount.toFixed(2),
                    },
                    ...(payeeEmail ? { payee: { email_address: payeeEmail } } : {}),
                },
            ],
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`PayPal create order failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    return { id: data.id };
}

export interface CaptureOrderResult {
    status: string;
    amount: number;
    currency: string;
    captureId: string;
    payerEmail?: string;
    payeeEmail?: string;
}

/**
 * Captures a previously-created and buyer-approved order. This is the only
 * point at which money actually moves — createPaypalOrder above never
 * charges anything by itself. Returns the AMOUNT PAYPAL ACTUALLY CAPTURED,
 * which the caller must use as the source of truth rather than whatever
 * amount it originally intended to charge, since this is what guards
 * against any mismatch between intent and reality.
 */
export async function capturePaypalOrder(orderId: string): Promise<CaptureOrderResult> {
    const token = await getAccessToken();

    const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`PayPal capture failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const purchaseUnit = data.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];

    if (!capture || data.status !== "COMPLETED") {
        throw new Error(`PayPal order not completed (status: ${data.status})`);
    }

    return {
        status: data.status,
        amount: parseFloat(capture.amount?.value ?? "0"),
        currency: capture.amount?.currency_code ?? "USD",
        captureId: capture.id,
        payerEmail: data.payer?.email_address,
        // Echoes back which account actually received the funds — useful to
        // store alongside the transaction, especially when PAYPAL_PAYEE_EMAIL
        // is set, so there's a record confirming the redirect actually applied.
        payeeEmail: purchaseUnit?.payee?.email_address,
    };
}