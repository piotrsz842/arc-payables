/**
 * RISKIEST STEP FIRST: prove we can pay USDC on Arc testnet with Circle wallets.
 *
 * This script has three commands, run them in order:
 *
 *   npm run pay -- create-wallets   → makes a "treasury" and a "contractor" wallet on ARC-TESTNET
 *   npm run pay -- balance          → shows the treasury's token balances
 *   npm run pay -- send 1           → sends 1 USDC treasury → contractor and waits until it's done
 *
 * Between create-wallets and send, fund the treasury at https://faucet.circle.com
 * (choose "Arc Testnet", USDC). On Arc, gas is ALSO paid in USDC, so the
 * treasury needs a little extra beyond the amount you send.
 *
 * Docs used:
 *   https://developers.circle.com/wallets/dev-controlled/create-your-first-wallet
 *   https://developers.circle.com/wallets/dev-controlled/transfer-tokens-across-wallets
 *   https://docs.arc.io/arc/references/contract-addresses  (USDC address)
 */
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

// --- Constants (verified against docs on 2026-11-12) ---
const BLOCKCHAIN = "ARC-TESTNET";
// USDC on Arc testnet. 6 decimals through this ERC-20 interface.
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
const EXPLORER = "https://explorer.testnet.arc.io";

// --- Read settings from .env ---
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

// The Circle client: every call below goes through it.
const circle = initiateDeveloperControlledWalletsClient({
  apiKey: requireEnv("CIRCLE_API_KEY"),
  entitySecret: requireEnv("CIRCLE_ENTITY_SECRET"),
});

// ---------------------------------------------------------------------------
// Command 1: create a wallet set and two wallets on Arc testnet
// ---------------------------------------------------------------------------
async function createWallets() {
  // A "wallet set" is just a folder that groups wallets together.
  const setRes = await circle.createWalletSet({ name: "arc-payables" });
  const walletSetId = setRes.data?.walletSet?.id;
  if (!walletSetId) throw new Error("Could not create wallet set");

  // EOA = a normal Ethereum-style account (simplest; works everywhere).
  const walletsRes = await circle.createWallets({
    walletSetId,
    blockchains: [BLOCKCHAIN],
    count: 2,
    accountType: "EOA",
  });
  const [treasury, contractor] = walletsRes.data?.wallets ?? [];
  if (!treasury || !contractor) throw new Error("Could not create wallets");

  console.log("Created 2 wallets on", BLOCKCHAIN);
  console.log("\nAdd these lines to your .env file:\n");
  console.log(`TREASURY_WALLET_ID=${treasury.id}`);
  console.log(`TREASURY_WALLET_ADDRESS=${treasury.address}`);
  console.log(`CONTRACTOR_WALLET_ADDRESS=${contractor.address}`);
  console.log(`\nThen fund the treasury at https://faucet.circle.com (Arc Testnet, USDC):`);
  console.log(`  ${treasury.address}`);
}

// ---------------------------------------------------------------------------
// Command 2: show the treasury's balances
// ---------------------------------------------------------------------------
async function showBalance() {
  const res = await circle.getWalletTokenBalance({ id: requireEnv("TREASURY_WALLET_ID") });
  const balances = res.data?.tokenBalances ?? [];
  if (balances.length === 0) {
    console.log("Treasury is empty. Fund it at https://faucet.circle.com");
    return;
  }
  for (const b of balances) {
    console.log(`${b.token?.symbol ?? "?"}: ${b.amount}`);
  }
}

// ---------------------------------------------------------------------------
// Command 3: send USDC treasury → contractor, then wait for it to finish
// ---------------------------------------------------------------------------
async function send(amount: string) {
  const res = await circle.createTransaction({
    blockchain: BLOCKCHAIN,
    walletAddress: requireEnv("TREASURY_WALLET_ADDRESS"),
    tokenAddress: ARC_TESTNET_USDC,
    destinationAddress: requireEnv("CONTRACTOR_WALLET_ADDRESS"),
    amount: [amount], // a string like "1" means 1 USDC (Circle handles decimals)
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const txId = res.data?.id;
  if (!txId) throw new Error("Circle did not return a transaction id");
  console.log(`Submitted Circle transaction ${txId}. Waiting...`);

  // Circle processes the transaction in the background, so we ask every
  // 3 seconds until it reaches a final state.
  const FINAL_STATES = ["COMPLETE", "FAILED", "CANCELLED", "DENIED"];
  while (true) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await circle.getTransaction({ id: txId });
    const tx = poll.data?.transaction;
    console.log(`  state: ${tx?.state}`);
    if (tx?.state && FINAL_STATES.includes(tx.state)) {
      if (tx.state === "COMPLETE") {
        console.log(`\nPayment done! ${EXPLORER}/tx/${tx.txHash}`);
      } else {
        console.log(`\nPayment did not complete: ${tx.state}`, tx.errorReason ?? "");
      }
      return;
    }
  }
}

// --- Pick the command from the command line ---
const [command, arg] = process.argv.slice(2);
if (command === "create-wallets") await createWallets();
else if (command === "balance") await showBalance();
else if (command === "send") await send(arg ?? "1");
else console.log("Usage: npm run pay -- create-wallets | balance | send <amount>");
