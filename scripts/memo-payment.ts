/**
 * Pay a contractor in USDC with the invoice ID attached as an onchain memo,
 * then read the chain ourselves to prove the memo is there.
 *
 * Run:
 *   npm run memo-pay -- pay <invoiceId> <amountUsdc>     e.g. pay INV-0002 1
 *   npm run memo-pay -- verify <txHash> <invoiceId>      check an earlier payment, no money moves
 *
 * How it works:
 *   our treasury wallet → calls Arc's Memo contract → which makes the USDC
 *   transfer AS our wallet (via Arc's CallFrom feature) and emits a Memo event
 *   containing the invoice ID.
 */
import { type Address, type Hex } from "viem";
import { buildMemoTransferCall, EXPLORER, invoiceMemoId, MEMO_ADDRESS, readMemoPayment } from "../lib/arc.js";
import { circle, requireEnv, waitForTransaction } from "../lib/circle.js";

async function pay(invoiceId: string, amount: string): Promise<Hex> {
  const contractor = requireEnv("CONTRACTOR_WALLET_ADDRESS") as Address;

  // 1. Build the raw call to the Memo contract (see lib/arc.ts).
  const callData = buildMemoTransferCall(contractor, amount, invoiceId);

  // 2. Ask Circle to sign and send it from the treasury wallet.
  const res = await circle.createContractExecutionTransaction({
    walletId: requireEnv("TREASURY_WALLET_ID"),
    contractAddress: MEMO_ADDRESS,
    callData,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    refId: invoiceId, // Circle-side label only (offchain), handy in the Circle Console
  });
  const txId = res.data?.id;
  if (!txId) throw new Error("Circle did not return a transaction id");
  console.log(`Paying ${amount} USDC for invoice ${invoiceId} (Circle tx ${txId})...`);

  const result = await waitForTransaction(txId);
  if (result.state !== "COMPLETE" || !result.txHash) {
    throw new Error(`Payment did not complete: ${result.state} ${result.errorReason ?? ""}`);
  }
  console.log(`\nCircle says COMPLETE: ${EXPLORER}/tx/${result.txHash}`);
  return result.txHash as Hex;
}

// 3. Don't just trust Circle: read the transaction from Arc and check it.
async function verify(txHash: Hex, invoiceId: string) {
  const p = await readMemoPayment(txHash);
  console.log("\nVerified on Arc:");
  console.log(`  tx succeeded:     ${p.success}`);
  console.log(`  memo text:        ${p.invoiceText}`);
  console.log(`  memoId matches:   ${p.memoId === invoiceMemoId(invoiceId)}`);
  console.log(`  paid by:          ${p.payer}`);
  console.log(`  paid to:          ${p.to}`);
  console.log(`  amount (USDC):    ${p.amountUsdc}`);
}

const [command, a, b] = process.argv.slice(2);
if (command === "pay" && a && b) await verify(await pay(a, b), a);
else if (command === "verify" && a && b) await verify(a as Hex, b);
else console.log("Usage: npm run memo-pay -- pay <invoiceId> <amount> | verify <txHash> <invoiceId>");
