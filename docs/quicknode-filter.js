// QuickNode Streams filter (JavaScript). Network: Arc Testnet. Dataset: Logs.
// Keeps only Memo events sent by the Notes by Students platform wallet,
// i.e. our cash-outs (each memo is a payout ID like "PO-3f9a1c2b7d").
// Returning null skips the block (nothing is sent to the webhook).
function main(stream) {
  const MEMO_CONTRACT = "0x5294e9927c3306dcbadb03fe70b92e01ccede505";
  // keccak256("Memo(address,address,bytes32,bytes32,bytes,uint256)")
  const MEMO_TOPIC = "0xeb15ee720798341c37739df41be53acfbbf70ae6802dade35457beec6e47a5e4";
  // topics[1] = the sender (indexed), padded to 32 bytes = our platform wallet
  const PLATFORM_SENDER = "0x000000000000000000000000682f94386d613fb53fe4e21c566d13fcc4548c80";

  const hits = [];
  for (const block of stream.data) {
    // The Logs dataset nests arrays; flatten so every log is visited.
    for (const log of [block].flat(Infinity)) {
      if (
        log &&
        typeof log.address === "string" &&
        log.address.toLowerCase() === MEMO_CONTRACT &&
        Array.isArray(log.topics) &&
        log.topics[0] === MEMO_TOPIC &&
        String(log.topics[1] || "").toLowerCase() === PLATFORM_SENDER
      ) {
        hits.push(log);
      }
    }
  }
  return hits.length ? { cashouts: hits } : null;
}
