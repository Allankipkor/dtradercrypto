export function getUsdtDepositAddress(): string | null {
  return process.env.CRYPTO_USDT_ADDRESS ?? null;
}

export function isCryptoConfigured(): boolean {
  return !!getUsdtDepositAddress();
}

export function isAutoConfirmEnabled(): boolean {
  return process.env.CRYPTO_AUTO_CONFIRM === "true";
}

export function generateDepositReference(): string {
  return `OM${Date.now().toString(36).toUpperCase()}`;
}

// Official USDT TRC20 contract address on TRON mainnet. This is a fixed,
// well-known constant — not configurable — since pointing at a different
// contract would mean accepting a token that merely LOOKS like USDT.
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_DECIMALS = 6;

const TRONGRID_BASE_URL = "https://api.trongrid.io";

interface TronGridTrc20Transfer {
  transaction_id: string;
  token_info: {
    symbol: string;
    address: string;
    decimals: number;
    name: string;
  };
  block_timestamp: number;
  from: string;
  to: string;
  type: string;
  value: string; // amount in the token's smallest unit (sun-equivalent), as a string
}

interface TronGridTrc20Response {
  success: boolean;
  data: TronGridTrc20Transfer[];
}

export interface VerifyUsdtTransferResult {
  verified: boolean;
  reason?: string;
  amount?: number;
  from?: string;
}

/**
 * Verifies that a given transaction hash corresponds to a REAL, on-chain
 * USDT (TRC20) transfer of at least `minAmount` to our own deposit address.
 *
 * This exists because the crypto deposit confirmation flow previously
 * trusted whatever string the user typed into the txHash field — any
 * 10+ character value was accepted and credited immediately, with zero
 * verification against the actual TRON blockchain. This function is what
 * replaces that blind trust with a real check, using TronGrid's public,
 * free, read-only API (no private key or wallet access needed — this only
 * ever reads the chain, never signs or sends anything).
 */
export async function verifyUsdtTransfer(params: {
  txHash: string;
  minAmount: number;
}): Promise<VerifyUsdtTransferResult> {
  const ourAddress = getUsdtDepositAddress();
  if (!ourAddress) {
    return { verified: false, reason: "Crypto deposits not configured" };
  }

  const apiKey = process.env.TRONGRID_API_KEY; // optional but recommended — see note below

  try {
    const url = new URL(`${TRONGRID_BASE_URL}/v1/accounts/${ourAddress}/transactions/trc20`);
    url.searchParams.set("only_to", "true");
    url.searchParams.set("only_confirmed", "true");
    url.searchParams.set("contract_address", USDT_TRC20_CONTRACT);
    url.searchParams.set("limit", "50");

    const res = await fetch(url.toString(), {
      headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : {},
    });

    if (!res.ok) {
      return { verified: false, reason: "Could not reach the TRON network to verify this transaction" };
    }

    const data: TronGridTrc20Response = await res.json();
    if (!data.success) {
      return { verified: false, reason: "TRON network lookup failed" };
    }

    const match = data.data.find((t) => t.transaction_id === params.txHash);
    if (!match) {
      // Not found among our most recent 50 confirmed incoming USDT
      // transfers. Either it hasn't confirmed yet (TRON blocks are ~3s, so
      // this should usually be quick), it's not actually a transfer to our
      // address, or it's not USDT TRC20 at all.
      return {
        verified: false,
        reason: "Transaction not found among confirmed USDT transfers to our address. If you just sent it, wait a minute and try again.",
      };
    }

    // Belt-and-suspenders: confirm the contract really is USDT, even though
    // we already filtered by contract_address — defends against a future
    // change to this function accidentally dropping that filter.
    if (match.token_info.address !== USDT_TRC20_CONTRACT) {
      return { verified: false, reason: "Transaction is not a USDT TRC20 transfer" };
    }

    const decimals = match.token_info.decimals ?? USDT_DECIMALS;
    const amount = Number(match.value) / Math.pow(10, decimals);

    if (!Number.isFinite(amount) || amount <= 0) {
      return { verified: false, reason: "Could not parse the on-chain transfer amount" };
    }

    // Allow the sender to have sent slightly more than requested (rounding,
    // network fee handling on their side) but never less.
    if (amount < params.minAmount - 0.000001) {
      return {
        verified: false,
        reason: `On-chain amount (${amount} USDT) is less than the requested deposit (${params.minAmount} USDT)`,
      };
    }

    return { verified: true, amount, from: match.from };
  } catch (err) {
    console.error("verifyUsdtTransfer error:", err);
    return { verified: false, reason: "Error verifying transaction on-chain" };
  }
}