/**
 * Moving money INTO and OUT OF Circle Gateway with our Circle wallets.
 *
 * IN (top-ups): the student's wallet calls GatewayWallet.depositFor(USDC,
 *   tutorAgent, amount). The money lands straight in the tutor agent's
 *   Gateway balance, its spending money, with no extra hop and no manual
 *   deposit script.
 *
 * OUT (cash-outs): authors are paid from the platform's Gateway income
 *   (every x402 sale settles there). Gateway withdrawal = a "burn intent":
 *     1. the platform wallet signs an EIP-712 BurnIntent ("take `value` from
 *        my Gateway balance, mint it to `recipient` on Arc"),
 *     2. Circle's Gateway API checks the balance and returns an attestation,
 *     3. anyone submits GatewayMinter.gatewayMint(attestation, signature) and
 *        the USDC is minted to the recipient.
 *   Same-chain (Arc → Arc) is supported, with no transfer fee (only burn gas).
 *
 * Sources: @circle-fin/x402-batching 4.0.0 GatewayClient.depositFor/withdraw
 * (installed code), https://developers.circle.com/gateway/references/technical-guide,
 * https://developers.circle.com/gateway/references/fees.
 */
import "server-only";
import { encodeFunctionData, erc20Abi, maxUint256, pad, parseAbi, parseUnits, zeroAddress, type Address, type Hex } from "viem";
import { GATEWAY_API, GATEWAY_WALLET, USDC_ADDRESS, USDC_DECIMALS } from "@/lib/arc";
import { circle, requireEnv, waitForTransaction } from "@/lib/circle";

export const GATEWAY_MINTER: Address = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B"; // testnet
const ARC_DOMAIN = 26;
// Most Gateway may charge for one withdrawal (Arc → Arc: burn gas only).
const MAX_FEE_USD = "0.05";

const gatewayWalletAbi = parseAbi(["function depositFor(address token, address depositor, uint256 value)"]);
export const gatewayMinterAbi = parseAbi(["function gatewayMint(bytes attestationPayload, bytes signature)"]);

/** Run one contract call from a Circle wallet and wait for it. Returns the tx hash. */
async function execute(walletId: string, contractAddress: Address, callData: Hex, refId: string): Promise<Hex> {
  const res = await circle.createContractExecutionTransaction({
    walletId,
    contractAddress,
    callData,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    refId,
  });
  const txId = res.data?.id;
  if (!txId) throw new Error("Circle did not return a transaction id");
  const result = await waitForTransaction(txId);
  if (result.state !== "COMPLETE" || !result.txHash) throw new Error(`${refId}: ${result.state} ${result.errorReason ?? ""}`);
  return result.txHash as Hex;
}

// ---------------------------------------------------------------------------
// IN: student's wallet → tutor agent's Gateway balance
// ---------------------------------------------------------------------------
export async function depositForAgent(walletId: string, amountUsd: string, refId: string) {
  const agent = requireEnv("AGENT_ADDRESS") as Address;
  const value = parseUnits(amountUsd, USDC_DECIMALS);
  // 1. Let the GatewayWallet contract take exactly this amount of USDC.
  const approveTx = await execute(
    walletId,
    USDC_ADDRESS,
    encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [GATEWAY_WALLET, value] }),
    `${refId}:approve`,
  );
  // 2. Deposit it, credited to the AGENT (depositFor), not to the student.
  const depositTx = await execute(
    walletId,
    GATEWAY_WALLET,
    encodeFunctionData({ abi: gatewayWalletAbi, functionName: "depositFor", args: [USDC_ADDRESS, agent, value] }),
    `${refId}:deposit`,
  );
  return { approveTx, depositTx };
}

// ---------------------------------------------------------------------------
// OUT: platform's Gateway income → anyone on Arc
// ---------------------------------------------------------------------------
const b32 = (a: Address) => pad(a.toLowerCase() as Hex, { size: 32 });

/**
 * Ask Gateway for a signed permission to mint `amountUsd` from the platform's
 * Gateway balance to `recipient` on Arc. Returns the gatewayMint call data;
 * the caller decides how to submit it (we wrap it in a Memo call).
 */
export async function platformGatewayMintCall(recipient: Address, amountUsd: string): Promise<Hex> {
  const platform = requireEnv("TREASURY_WALLET_ADDRESS") as Address;
  const burnIntent = {
    maxBlockHeight: maxUint256,
    maxFee: parseUnits(MAX_FEE_USD, USDC_DECIMALS),
    spec: {
      version: 1,
      sourceDomain: ARC_DOMAIN,
      destinationDomain: ARC_DOMAIN,
      sourceContract: b32(GATEWAY_WALLET),
      destinationContract: b32(GATEWAY_MINTER),
      sourceToken: b32(USDC_ADDRESS),
      destinationToken: b32(USDC_ADDRESS),
      sourceDepositor: b32(platform),
      destinationRecipient: b32(recipient),
      sourceSigner: b32(platform),
      destinationCaller: b32(zeroAddress), // anyone may submit the mint
      value: parseUnits(amountUsd, USDC_DECIMALS),
      salt: `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}` as Hex,
      hookData: "0x" as Hex,
    },
  };
  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
      ],
      TransferSpec: [
        { name: "version", type: "uint32" },
        { name: "sourceDomain", type: "uint32" },
        { name: "destinationDomain", type: "uint32" },
        { name: "sourceContract", type: "bytes32" },
        { name: "destinationContract", type: "bytes32" },
        { name: "sourceToken", type: "bytes32" },
        { name: "destinationToken", type: "bytes32" },
        { name: "sourceDepositor", type: "bytes32" },
        { name: "destinationRecipient", type: "bytes32" },
        { name: "sourceSigner", type: "bytes32" },
        { name: "destinationCaller", type: "bytes32" },
        { name: "value", type: "uint256" },
        { name: "salt", type: "bytes32" },
        { name: "hookData", type: "bytes" },
      ],
      BurnIntent: [
        { name: "maxBlockHeight", type: "uint256" },
        { name: "maxFee", type: "uint256" },
        { name: "spec", type: "TransferSpec" },
      ],
    },
    domain: { name: "GatewayWallet", version: "1" },
    primaryType: "BurnIntent",
    message: burnIntent,
  };
  const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

  // 1. The platform's Circle wallet signs the burn intent (its key never leaves Circle).
  const signed = await circle.signTypedData({ walletId: requireEnv("TREASURY_WALLET_ID"), data: json(typedData) });
  const signature = signed.data?.signature;
  if (!signature) throw new Error("Circle did not sign the burn intent");

  // 2. Gateway checks the platform's balance and returns a signed attestation.
  const res = await fetch(`${GATEWAY_API}/v1/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json([{ burnIntent, signature }]),
  });
  const result = (await res.json()) as { attestation?: Hex; signature?: Hex; message?: string; error?: string };
  if (!res.ok || !result.attestation || !result.signature) {
    throw new GatewayWithdrawError(result.message ?? result.error ?? `Gateway API HTTP ${res.status}`);
  }
  // 3. The mint call anyone can submit on Arc.
  return encodeFunctionData({ abi: gatewayMinterAbi, functionName: "gatewayMint", args: [result.attestation, result.signature] });
}

export class GatewayWithdrawError extends Error {}

