/**
 * Every user gets a Circle wallet on Arc testnet at signup, behind the scenes:
 * no seed phrase, no wallet app, no gas token to buy. Circle holds the keys
 * (developer-controlled wallets) and only signs when OUR server asks with our
 * entity secret. The user never sees an address unless they open "details".
 *
 * Docs: https://developers.circle.com/wallets/dev-controlled/create-your-first-wallet
 */
import "server-only";
import { BLOCKCHAIN } from "@/lib/arc";
import { circle } from "@/lib/circle";

// All user wallets live in one wallet set (Circle's folder for wallets).
const USER_WALLET_SET = "notes-by-students-users";
let walletSetId: string | undefined;

async function userWalletSetId(): Promise<string> {
  if (walletSetId) return walletSetId;
  const existing = await circle.listWalletSets();
  const found = existing.data?.walletSets?.find((s) => "name" in s && s.name === USER_WALLET_SET);
  if (found?.id) return (walletSetId = found.id);
  const created = await circle.createWalletSet({ name: USER_WALLET_SET });
  const id = created.data?.walletSet?.id;
  if (!id) throw new Error("Could not create the user wallet set");
  return (walletSetId = id);
}

/** Create one EOA wallet on Arc testnet (EOA: needed for Arc's Memo contract at cash-out). */
export async function createUserWallet(): Promise<{ id: string; address: string }> {
  const res = await circle.createWallets({
    walletSetId: await userWalletSetId(),
    blockchains: [BLOCKCHAIN],
    count: 1,
    accountType: "EOA",
  });
  const wallet = res.data?.wallets?.[0];
  if (!wallet?.id || !wallet.address) throw new Error("Circle did not return a wallet");
  return { id: wallet.id, address: wallet.address };
}
