# Payment Integration Documentation

This folder contains the API routes and handlers for processing deposits and checking transaction status on the platform.

## Supported Payment Methods

1. **Crypto (USDT TRC20)** — Direct crypto transfer where users paste their transaction hash for manual/automatic verification.
2. **Card (PayPal)** — PayPal hosted buttons for credit/debit card processing.
3. **M-Pesa (Kenya)** — Direct STK Push prompts using Lipia Online / PayHero API.
4. **Paystack** — Online checkout (Card, Mobile Money, Bank Transfer) via Paystack inline/redirect.

---

## Paystack Integration

Paystack is used to accept international and local cards, mobile money, and bank transfers.

### Environment Variables

```env
PAYSTACK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY="pk_test_..."
PAYSTACK_CURRENCY="USD"              # Checkout currency (USD or KES)
PAYSTACK_AUTO_CONFIRM=false          # Set to true in dev to mock success instantly
```

### Application Flow

1. **Initiation**: The frontend calls `/api/payments/deposit` with `method: "paystack"`.
2. **Processing**: The backend initializes a transaction via Paystack's REST API and returns an `authorizationUrl`.
3. **Redirect/Polling**: The frontend opens the `authorizationUrl` in a new tab. In the background, the client polls `/api/payments/status/[id]` to monitor the transaction's status.
4. **Webhook**: The `/api/payments/paystack/webhook` route listens for signature-verified `charge.success` events from Paystack to credit user balances in real time.

---

## M-Pesa Integration (PayHero / Safaricom)

Uses PayHero Basic authentication to trigger M-Pesa STK push.

### Environment Variables

```env
PAYHERO_API_USERNAME="your_username"
PAYHERO_API_PASSWORD="your_password"
PAYHERO_CHANNEL_ID="your_channel_id"
MPESA_CALLBACK_URL="https://yourdomain.com/api/payments/mpesa/callback"
USD_TO_KES=130
MPESA_AUTO_CONFIRM=false
```

