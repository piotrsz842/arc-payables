/**
 * ERC-8004 ("trustless agents") on Arc: an on-chain identity and reputation
 * for our tutor agent.
 *
 *   IDENTITY   the platform wallet registers the tutor in the IdentityRegistry
 *              (an ERC-721: the agent is token #agentId). Its metadata URI
 *              points to our public /agent.json (name, wallet, what it does).
 *   REPUTATION after each question, the CHECKER's own wallet records feedback
 *              in the ReputationRegistry: how many of the tutor's purchase
 *              proposals passed the checker (score 0–100, tag
 *              "purchase_discipline"). ERC-8004 doesn't let an agent's owner
 *              rate its own agent, so the checker uses a separate wallet.
 *
 * Source: https://docs.arc.io/arc/tutorials/register-your-first-ai-agent
 * (addresses: https://docs.arc.io/arc/references/contract-addresses), checked 2026-11-18.
 */
import { encodeFunctionData, keccak256, parseAbi, parseEventLogs, toHex, type Address, type Hex } from "viem";
import { arcClient } from "./arc";
import { circle } from "./circle";

export const IDENTITY_REGISTRY: Address = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
export const REPUTATION_REGISTRY: Address = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

const identityAbi = parseAbi([
  "function register(string metadataURI)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);
const reputationAbi = parseAbi([
  "function giveFeedback(uint256 agentId, int128 score, uint8 feedbackType, string tag, string metadataURI, string evidenceURI, string comment, bytes32 feedbackHash)",
]);

export const FEEDBACK_TAG = "purchase_discipline";

/** Build the register(metadataURI) call. */
export const registerCall = (metadataURI: string): Hex =>
  encodeFunctionData({ abi: identityAbi, functionName: "register", args: [metadataURI] });

/** The new agent's id = the tokenId of the ERC-721 Transfer (mint) to the owner in the registration tx. */
export async function agentIdFromRegistration(txHash: Hex, owner: Address): Promise<bigint> {
  const receipt = await arcClient.getTransactionReceipt({ hash: txHash });
  const mints = parseEventLogs({ abi: identityAbi, eventName: "Transfer", logs: receipt.logs }).filter(
    (e) => e.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() && e.args.to.toLowerCase() === owner.toLowerCase(),
  );
  const last = mints.at(-1);
  if (!last) throw new Error("No Transfer to the owner in that transaction");
  return last.args.tokenId;
}

export async function readIdentity(agentId: bigint) {
  const [owner, uri] = await Promise.all([
    arcClient.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "ownerOf", args: [agentId] }),
    arcClient.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "tokenURI", args: [agentId] }),
  ]);
  return { owner, uri };
}

/**
 * Record one question's purchase discipline as reputation, from the checker's
 * wallet. Fire-and-forget: Circle sends the transaction in the background, so
 * the student never waits for it. Does nothing if ERC-8004 isn't set up.
 */
export async function recordPurchaseDiscipline(summary: { runId: string; proposed: number; allowed: number }): Promise<string | null> {
  const agentId = process.env.TUTOR_AGENT_ID;
  const checkerWalletId = process.env.CHECKER_WALLET_ID;
  if (!agentId || !checkerWalletId || summary.proposed === 0) return null;
  const score = Math.round((100 * summary.allowed) / summary.proposed);
  const comment = `${summary.allowed} of ${summary.proposed} purchase proposals passed the checker (question ${summary.runId})`;
  try {
    const res = await circle.createContractExecutionTransaction({
      walletId: checkerWalletId,
      contractAddress: REPUTATION_REGISTRY,
      callData: encodeFunctionData({
        abi: reputationAbi,
        functionName: "giveFeedback",
        args: [BigInt(agentId), BigInt(score), 0, FEEDBACK_TAG, "", "", comment, keccak256(toHex(FEEDBACK_TAG))],
      }),
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
      refId: `reputation:${summary.runId}`,
    });
    return res.data?.id ?? null; // Circle transaction id (it completes in the background)
  } catch (err) {
    console.error("Could not record ERC-8004 reputation:", err);
    return null;
  }
}
