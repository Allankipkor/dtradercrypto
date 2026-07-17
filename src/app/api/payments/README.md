# Payment Integration Documentation

This folder contains the API routes and handlers for processing deposits and checking transaction status on the platform.

## Supported Payment Methods

1. **Crypto (USDT TRC20)** — Direct crypto transfer where users paste their transaction hash for manual/automatic verification.
2. **Card (PayPal)** — PayPal hosted buttons for credit/debit card processing.
3. **M-Pesa (Kenya)** — Direct STK Push prompts using Lipia Online / PayHero API.
4. **Mobile Money – Zambia (MoneyUnify)** — Aggregated mobile money payments (MTN, Airtel, Zamtel) in Zambia.

---

## MoneyUnify Zambia Integration

MoneyUnify (`moneyunify.one`) is a mobile money aggregator API used to initiate and verify Zambian Kwacha (ZMW) payments from MTN, Airtel, and Zamtel wallets.

### 1. Environment Variables

To configure MoneyUnify, add the following variables to your `.env` file:

```env
# MoneyUnify API Configuration
MONEYUNIFY_AUTH_ID="your_moneyunify_auth_id_public_key"
USD_TO_ZMW=26.0               # Exchange rate for converting USD deposits to ZMW
MONEYUNIFY_AUTO_CONFIRM=false  # Set to true in local development to mock success instantly
```

### 2. Endpoints Used

* **Initiate Payment (Request to Pay)**:
  * **Endpoint**: `POST https://api.moneyunify.one/payments/request`
  * **Payload (urlencoded)**:
    * `from_payer`: Payer's local 10-digit phone number (formatted automatically to `097XXXXXXX` or `096XXXXXXX` etc.)
    * `amount`: Amount in ZMW
    * `auth_id`: Public Key (`MONEYUNIFY_AUTH_ID`)
  * **Response**: Returns a `transaction_id` which must be saved to verify payment.

* **Verify Payment**:
  * **Endpoint**: `POST https://api.moneyunify.one/payments/verify`
  * **Payload (urlencoded)**:
    * `auth_id`: Public Key (`MONEYUNIFY_AUTH_ID`)
    * `transaction_id`: The `transaction_id` returned during initiation.
  * **Response**: Returns the status of the transaction (`successful`, `failed`, `initiated`).

### 3. Application Flow

1. **UI Tab**: In the deposit modal, "Zambia MM" is dynamically shown only if the user's country is set to "Zambia" (or they register/format a Zambian phone number starting with `260` / `+260`).
2. **Initiation**: The frontend calls `/api/payments/deposit` with method `"moneyunify"` and amount in USD.
3. **Processing**: The backend converts USD to ZMW, creates a pending transaction record, formats the phone number, and calls MoneyUnify's `/payments/request` API. It stashes the MoneyUnify transaction ID in transaction `metadata`.
4. **Polling**: The frontend polls `/api/payments/status/[transactionId]` every 3 seconds. The backend calls MoneyUnify's `/payments/verify` API, updates the transaction status, and credits the user's balance upon confirmation.

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
