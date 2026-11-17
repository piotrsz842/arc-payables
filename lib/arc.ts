/**
 * Everything we know about Arc testnet, in one place.
 * Sources (checked 2026-11-12):
 *   https://docs.arc.io/arc/references/contract-addresses
 *   https://docs.arc.io/arc/tutorials/send-usdc-with-transaction-memo
 *   Memo ABI: verified source at https://explorer.testnet.arc.io/address/0x5294E9927c3306DcBaDb03fe70b92e01cCede505
 */
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  hexToString,
  http,
  isAddressEqual,
  keccak256,
  parseAbi,
  parseEventLogs,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { arcTestnet } from "viem/chains";

export const BLOCKCHAIN = "ARC-TESTNET"; // Circle's name for the chain
export const EXPLORER = "https://explorer.testnet.arc.io";

// USDC's ERC-20 interface on Arc. Always 6 decimals here (1 USDC = 1_000_000).
export const USDC_ADDRESS: Address = "0x3600000000000000000000000000000000000000";
export const USDC_DECIMALS = 6;

// EURC (euro stablecoin) on Arc testnet. Also 6 decimals.
export const EURC_ADDRESS: Address = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
export const EURC_DECIMALS = 6;

/** Read a wallet's balance of a 6-decimal token (USDC or EURC) straight from Arc, e.g. "0.85". */
export async function tokenBalance(token: Address, owner: Address): Promise<string> {
  const raw = await arcClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
  return formatUnits(raw, 6); // both USDC and EURC use 6 decimals on Arc
}

export const eurcBalance = (owner: Address) => tokenBalance(EURC_ADDRESS, owner);
export const usdcBalance = (owner: Address) => tokenBalance(USDC_ADDRESS, owner);

// --- Circle Gateway (Nanopayments) on Arc testnet ---
// Source: https://developers.circle.com/gateway/references/contract-addresses
// and the @circle-fin/x402-batching 4.0.0 package itself (checked 2026-11-16).
export const ARC_NETWORK = "eip155:5042002"; // Arc testnet in x402's "CAIP-2" naming
export const GATEWAY_WALLET: Address = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9"; // holds deposits
// The SDK defaults to MAINNET. Always pass this URL on testnet.
export const GATEWAY_API = "https://gateway-api-testnet.circle.com";

// Arc's built-in Memo contract. EOA wallets only.
export const MEMO_ADDRESS: Address = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505";
// The Memo contract emits TWO events per call: BeforeMemo (just a counter)
// and then Memo (the one with our invoice ID). List both so viem can read either.
export const memoAbi = parseAbi([
  "function memo(address target, bytes data, bytes32 memoId, bytes memoData)",
  "event BeforeMemo(uint256 indexed memoIndex)",
  "event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)",
]);

// Read-only connection to Arc, used to check results on the chain ourselves.
export const arcClient = createPublicClient({ chain: arcTestnet, transport: http() });

/**
 * Turn an invoice ID into the memo's fixed-size fingerprint (bytes32).
 * Same invoice ID → same memoId, so the webhook can find the invoice again.
 */
export function invoiceMemoId(invoiceId: string): Hex {
  return keccak256(stringToHex(invoiceId));
}

/**
 * Build the raw call: "Memo contract, please transfer `amountUsdc` USDC to
 * `to` on my behalf, and announce `invoiceId` next to it."
 *
 * PRIVACY: memos are public forever. Only put an invoice ID here,
 * never names, emails, or bank details.
 */
export function buildMemoTransferCall(to: Address, amountUsdc: string, invoiceId: string): Hex {
  // Step 1: the inner instruction for the USDC contract: transfer(to, amount).
  const transferData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, parseUnits(amountUsdc, USDC_DECIMALS)], // "250" → 250000000n
  });

  // Step 2: wrap it in a call to Memo.memo(target, data, memoId, memoData).
  return encodeFunctionData({
    abi: memoAbi,
    functionName: "memo",
    args: [USDC_ADDRESS, transferData, invoiceMemoId(invoiceId), stringToHex(invoiceId)],
  });
}

/**
 * Read a transaction from Arc and pull out (a) our Memo event and (b) the
 * USDC transfer it made. This is "trust the chain": we check what actually
 * happened instead of believing any API's "COMPLETE".
 */
export async function readMemoPayment(txHash: Hex) {
  const receipt = await arcClient.getTransactionReceipt({ hash: txHash });

  // parseEventLogs picks out only the events we ask for, by name.
  const [memo] = parseEventLogs({ abi: memoAbi, eventName: "Memo", logs: receipt.logs })
    .filter((e) => isAddressEqual(e.address, MEMO_ADDRESS));

  // Only the USDC contract's Transfer (6 decimals), not the native one from 0xfff...fe.
  const [transfer] = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs })
    .filter((e) => isAddressEqual(e.address, USDC_ADDRESS));

  return {
    success: receipt.status === "success",
    invoiceText: memo ? hexToString(memo.args.memo) : null,
    memoId: memo?.args.memoId ?? null,
    payer: memo?.args.sender ?? null,
    to: transfer?.args.to ?? null,
    amountUsdc: transfer ? formatUnits(transfer.args.value, USDC_DECIMALS) : null, // 1000000n → "1"
  };
}
