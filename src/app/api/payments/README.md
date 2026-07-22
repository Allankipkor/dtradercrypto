# Payment Integration Documentation

This folder contains the API routes and handlers for processing deposits and checking transaction status on the platform.

## Supported Payment Methods

1. **Crypto (USDT TRC20)** — Direct crypto transfer where users paste their transaction hash for manual/automatic verification.
2. **Card (PayPal)** — PayPal hosted buttons for credit/debit card processing.
3. **M-Pesa (Kenya)** — Direct STK Push prompts using Lipia Online / PayHero API.

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
