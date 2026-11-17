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
 */
import { BLOCKCHAIN, EXPLORER, USDC_ADDRESS } from "../lib/arc.js";
import { circle, requireEnv, waitForTransaction } from "../lib/circle.js";

// ---------------------------------------------------------------------------
// Command 1: create a wallet set and two wallets on Arc testnet
// ---------------------------------------------------------------------------
async function createWallets() {
  // A "wallet set" is just a folder that groups wallets together.
  const setRes = await circle.createWalletSet({ name: "arc-payables" });
  const walletSetId = setRes.data?.walletSet?.id;
  if (!walletSetId) throw new Error("Could not create wallet set");

  // EOA = a normal Ethereum-style account (simplest; works everywhere,
  // and Arc's Memo contract only accepts EOAs).
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
  // On Arc, USDC shows up twice: once as the native gas token and once as the
  // ERC-20 at 0x3600...0000. Both views read the SAME money, so don't add them up.
  for (const b of balances) {
    const kind = b.token?.isNative ? "native gas balance" : `ERC-20 ${b.token?.tokenAddress}`;
    console.log(`${b.token?.symbol ?? "?"}: ${b.amount}  (${kind})`);
  }
}

// ---------------------------------------------------------------------------
// Command 3: send USDC treasury → contractor (plain transfer, no memo)
// ---------------------------------------------------------------------------
async function send(amount: string, to?: string) {
  to ||= requireEnv("CONTRACTOR_WALLET_ADDRESS"); // || so an empty address never reaches Circle
  const res = await circle.createTransaction({
    blockchain: BLOCKCHAIN,
    walletAddress: requireEnv("TREASURY_WALLET_ADDRESS"),
    tokenAddress: USDC_ADDRESS,
    destinationAddress: to,
    amount: [amount], // a string like "1" means 1 USDC (Circle handles decimals)
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const txId = res.data?.id;
  if (!txId) throw new Error("Circle did not return a transaction id");
  console.log(`Submitted Circle transaction ${txId}. Waiting...`);

  const result = await waitForTransaction(txId);
  if (result.state === "COMPLETE") {
    console.log(`\nPayment done! ${EXPLORER}/tx/${result.txHash}`);
  } else {
    console.log(`\nPayment did not complete: ${result.state}`, result.errorReason ?? "");
  }
}

// ---------------------------------------------------------------------------
// Command 4: one extra contractor wallet (so demo vendors have their own addresses)
// ---------------------------------------------------------------------------
async function newContractor() {
  const setRes = await circle.createWalletSet({ name: "arc-payables-contractors" });
  const walletSetId = setRes.data?.walletSet?.id;
  if (!walletSetId) throw new Error("Could not create wallet set");
  const res = await circle.createWallets({ walletSetId, blockchains: [BLOCKCHAIN], count: 1, accountType: "EOA" });
  const wallet = res.data?.wallets?.[0];
  if (!wallet) throw new Error("Could not create wallet");
  console.log(`New contractor wallet on ${BLOCKCHAIN}: ${wallet.address}`);
}

// --- Pick the command from the command line ---
const [command, arg, arg2] = process.argv.slice(2);
if (command === "create-wallets") await createWallets();
else if (command === "new-contractor") await newContractor();
else if (command === "balance") await showBalance();
// send <amount> [address]: platform wallet → address (e.g. to give a test user test funds)
else if (command === "send") await send(arg ?? "1", arg2);
// Give the tutor agent its budget: platform wallet → agent wallet (plain USDC transfer).
else if (command === "fund-agent") await send(arg ?? "2", requireEnv("AGENT_ADDRESS"));
else console.log("Usage: npm run pay -- create-wallets | balance | send <amount> | fund-agent <amount>");
