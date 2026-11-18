// QuickNode Streams filter (JavaScript). Network: Arc Testnet. Dataset: Logs
// (also works with Receipts / Block with Receipts: it searches every nested object).
// Keeps only Memo events from the Memo contract whose indexed sender is the
// Notes by Students platform wallet, i.e. our cash-outs (memo = payout ID "PO-…").
// Returning null skips the block (nothing is sent to the webhook).
function main(stream) {
  const MEMO_CONTRACT = "0x5294e9927c3306dcbadb03fe70b92e01ccede505";
  // keccak256("Memo(address,address,bytes32,bytes32,bytes,uint256)")
  const MEMO_TOPIC = "0xeb15ee720798341c37739df41be53acfbbf70ae6802dade35457beec6e47a5e4";
  // topics[1] = the indexed sender, padded to 32 bytes = our platform wallet
  const PLATFORM_SENDER = "0x000000000000000000000000682f94386d613fb53fe4e21c566d13fcc4548c80";

  const hits = [];
  const visit = (v) => {
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
    } else if (v && typeof v === "object") {
      const isLog = typeof v.address === "string" && Array.isArray(v.topics);
      if (
        isLog &&
        v.address.toLowerCase() === MEMO_CONTRACT &&
        String(v.topics[0] || "").toLowerCase() === MEMO_TOPIC &&
        String(v.topics[1] || "").toLowerCase() === PLATFORM_SENDER
      ) {
        hits.push(v);
      } else if (!isLog) {
        for (const key in v) visit(v[key]); // e.g. receipts[].logs, block.transactions
      }
    }
  };
  visit(stream.data);
  return hits.length ? { cashouts: hits } : null;
}
