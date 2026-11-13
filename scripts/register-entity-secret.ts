/**
 * ONE-TIME SETUP: create and register your Circle "entity secret".
 *
 * What is an entity secret?
 *   Circle holds the private keys for developer-controlled wallets, but it will
 *   only sign a transaction if the request is authorised with YOUR entity secret.
 *   Think of it as the master password for every wallet this app controls.
 *
 * What this script does:
 *   1. Makes a random 32-byte secret (64 hex characters).
 *   2. Registers it with Circle (the SDK encrypts it with Circle's public key first).
 *   3. Saves a recovery file in ./recovery (gitignored) and adds the secret to .env.
 *
 * Run: npm run register-secret
 * Docs: https://developers.circle.com/wallets/dev-controlled/register-entity-secret
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) throw new Error("Put CIRCLE_API_KEY in .env first.");

// Safety check: don't overwrite a secret that is already registered.
if (process.env.CIRCLE_ENTITY_SECRET) {
  throw new Error("CIRCLE_ENTITY_SECRET is already set in .env. Nothing to do.");
}

const entitySecret = randomBytes(32).toString("hex");

mkdirSync("./recovery", { recursive: true });
await registerEntitySecretCiphertext({
  apiKey,
  entitySecret,
  recoveryFileDownloadPath: "./recovery",
});

// Fill in the empty CIRCLE_ENTITY_SECRET= line in .env (or add one if missing).
const envText = readFileSync(".env", "utf8");
const line = `CIRCLE_ENTITY_SECRET=${entitySecret}`;
if (/^CIRCLE_ENTITY_SECRET=.*$/m.test(envText)) {
  writeFileSync(".env", envText.replace(/^CIRCLE_ENTITY_SECRET=.*$/m, line));
} else {
  writeFileSync(".env", envText + `\n${line}\n`);
}
console.log("Entity secret registered and saved to .env.");
console.log("A recovery file is in ./recovery. Back it up somewhere private (NOT git).");
