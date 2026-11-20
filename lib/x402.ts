/**
 * The SELLER side of x402: "pay first, then you get the content".
 *
 * The x402 conversation (two HTTP requests):
 *   1. Buyer:  GET /api/snippets/abc
 *      Us:     402 Payment Required + a PAYMENT-REQUIRED header saying
 *              "send $0.001 of USDC on Arc to this address, via Gateway".
 *   2. Buyer:  GET /api/snippets/abc again, with a Payment-Signature header:
 *              a signed authorization to take that amount from its Gateway balance.
 *      Us:     hand the signature to Circle Gateway (settle). If Gateway accepts
 *              it, we return the content + a PAYMENT-RESPONSE header (receipt).
 *
 * Why it costs no gas per payment: the buyer only SIGNS (offchain). Gateway
 * collects many signed payments and settles them onchain together, later.
 *
 * Pattern adapted from Circle's sample (circlefin/arc-nanopayments, lib/x402.ts),
 * but pointed at the TESTNET Gateway: the SDK's default URL is mainnet.
 * Docs: https://developers.circle.com/gateway/nanopayments/quickstarts/seller
 */
import "server-only";
import { BatchFacilitatorClient, GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS } from "@circle-fin/x402-batching/server";
import { NextResponse, type NextRequest } from "next/server";
import { parseUnits } from "viem";
import { ARC_NETWORK, GATEWAY_API, GATEWAY_WALLET, USDC_ADDRESS, USDC_DECIMALS } from "@/lib/arc";

// The client that talks to Circle Gateway for us.
const gateway = new BatchFacilitatorClient({ url: GATEWAY_API });

// The SDK doesn't export these two types by name, so we borrow them from settle().
type PaymentPayload = Parameters<BatchFacilitatorClient["settle"]>[0];
type PaymentRequirements = Parameters<BatchFacilitatorClient["settle"]>[1];

/** Who gets paid: the platform wallet (same Circle wallet as before the pivot). */
function sellerAddress(): string {
  const address = process.env.TREASURY_WALLET_ADDRESS;
  if (!address) throw new Error("Missing TREASURY_WALLET_ADDRESS");
  return address;
}

/** Our price list entry, in x402's format. Amount is in USDC's smallest unit (6 decimals). */
function requirementsFor(priceUsd: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: ARC_NETWORK,
    asset: USDC_ADDRESS,
    amount: parseUnits(priceUsd, USDC_DECIMALS).toString(), // "0.001" → "1000"
    payTo: sellerAddress(),
    // Gateway requires signed payments to stay valid at least 7 days. The SDK's
    // window is 7 days + 100 s, so a buyer whose clock is ~2 minutes slow gets
    // "authorization_validity_too_short" (seen 2026-11-19). One extra hour of slack.
    maxTimeoutSeconds: GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS + 3600,
    // "extra" tells the buyer: pay through Gateway's batching contract, not a plain transfer.
    extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: GATEWAY_WALLET },
  };
}

// x402 headers carry JSON encoded as base64.
const toBase64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64");
const fromBase64 = (text: string) => JSON.parse(Buffer.from(text, "base64").toString("utf8"));

/**
 * Use inside a route: `return requirePayment(req, { priceUsd, description }, () => content)`.
 * `deliver` only runs after Gateway has accepted the payment.
 */
export async function requirePayment(
  req: NextRequest,
  { priceUsd, description }: { priceUsd: string; description: string },
  deliver: (receipt: { payer: string; transaction: string }) => Response | Promise<Response>,
): Promise<Response> {
  const requirements = requirementsFor(priceUsd);
  const signature = req.headers.get("payment-signature");

  // Step 1: no payment attached → tell the buyer the price.
  if (!signature) {
    const paymentRequired = {
      x402Version: 2,
      resource: { url: req.url, description, mimeType: "application/json" },
      accepts: [requirements],
    };
    return NextResponse.json(
      { error: "Payment required" },
      { status: 402, headers: { "PAYMENT-REQUIRED": toBase64(paymentRequired) } },
    );
  }

  // Step 2: payment attached → ask Gateway to accept it against OUR requirements
  // (never the buyer's copy of them, so a buyer can't lower the price).
  let payload: PaymentPayload;
  try {
    payload = fromBase64(signature);
  } catch {
    return NextResponse.json({ error: "Malformed Payment-Signature header" }, { status: 400 });
  }

  const result = await gateway.settle(payload, requirements);
  if (!result.success) {
    return NextResponse.json({ error: "Payment was not accepted", reason: result.errorReason }, { status: 402 });
  }

  // Paid: hand over the content, plus a receipt header the buyer can read.
  const receipt = { payer: result.payer ?? "unknown", transaction: result.transaction };
  const response = await deliver(receipt);
  response.headers.set(
    "PAYMENT-RESPONSE",
    toBase64({ success: true, transaction: result.transaction, network: result.network, payer: receipt.payer }),
  );
  return response;
}
