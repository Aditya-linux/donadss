export type UnifiedPlan =
  | { kind: "scout"; prompt: string }
  | { kind: "sentinel"; bytecode: string }
  | { kind: "growth"; objective: string }
  | { kind: "operator"; objective: string; sources: string[] }
  | { kind: "flow"; recipient: string; amount: string; purpose: string; asset: "MON"; tokenContract: null }
  | { kind: "flow"; recipient: string; amount: string; purpose: string; asset: string; tokenContract: string }
  | { kind: "swap"; amount: string; inputAsset: string; tokenIn: string; outputAsset: string; tokenOut: string; slippageBps: number; maxPriceImpactBps: number }
  | { kind: "clarify"; message: string };

function urlsIn(value: string): string[] {
  return [...new Set(value.match(/https?:\/\/[^\s<>"']+/gi)?.map((url) => url.replace(/[),.;!?]+$/g, "")) ?? [])];
}

export function planUnifiedTask(rawPrompt: string): UnifiedPlan {
  const prompt = rawPrompt.trim();
  const lower = prompt.toLowerCase();
  const urls = urlsIn(prompt);
  const bytecode = prompt.match(/0x[0-9a-fA-F]{4,}/)?.[0];
  const recipient = prompt.match(/\b0x[0-9a-fA-F]{40}\b/)?.[0];
  const amount = prompt.match(/\b(\d+(?:\.\d{1,18})?)\s*MON\b/i)?.[1];
  const tokenTransfer = prompt.match(/\b(?:send|pay|transfer)\s+(\d+(?:\.\d+)?)\s+([A-Za-z][A-Za-z0-9._-]{0,15})\s+(?:token|contract)\s+(0x[0-9a-fA-F]{40})\s+to\s+(0x[0-9a-fA-F]{40})\b/i);
  const swap = prompt.match(/\bswap\s+(\d+(?:\.\d+)?)\s+([A-Za-z][A-Za-z0-9._-]{0,15})\s+token\s+(0x[0-9a-fA-F]{40})\s+for\s+([A-Za-z][A-Za-z0-9._-]{0,15})\s+token\s+(0x[0-9a-fA-F]{40})(?:\s+(?:with\s+)?max(?:imum)?\s+(\d+(?:\.\d{1,2})?)%\s+slippage)?/i);

  if (!prompt) return { kind: "clarify", message: "Describe the outcome you want DONADS to complete." };
  if (bytecode && /(audit|scan|bytecode|security|risk)/i.test(prompt)) return { kind: "sentinel", bytecode };

  const isCampaign = /(campaign|marketing|launch|content|posts?|growth|social)/i.test(prompt);
  if (isCampaign && urls.length) return { kind: "operator", objective: prompt, sources: urls.slice(0, 5) };
  if (isCampaign) return { kind: "growth", objective: prompt };
  if (urls.length || /(research|compare|investigate|summari[sz]e|find out)/i.test(prompt)) {
    if (!urls.length) return { kind: "clarify", message: "Add at least one public source URL so Scout can produce cited, verifiable research." };
    return { kind: "scout", prompt };
  }
  if (/(buy|order|purchase|checkout)/i.test(prompt)) {
    return { kind: "clarify", message: "Send the exact crypto-accepting product or checkout URL, asset, maximum budget, and delivery country. Commerce will verify the offer before asking for approval." };
  }
  if (/(trade|swap)/i.test(prompt)) {
    if (swap) return { kind: "swap", amount: swap[1], inputAsset: swap[2].toUpperCase(), tokenIn: swap[3], outputAsset: swap[4].toUpperCase(), tokenOut: swap[5], slippageBps: swap[6] ? Math.round(Number(swap[6]) * 100) : 50, maxPriceImpactBps: 200 };
    return { kind: "clarify", message: "Use: ‘Swap 1 USDC token 0xINPUT for DAI token 0xOUTPUT max 0.5% slippage’. Flow will query only the allowlisted Uniswap v3 Monad Testnet adapter and block quotes above policy." };
  }
  if (/(pay|send|transfer)/i.test(prompt)) {
    if (tokenTransfer) return { kind: "flow", amount: tokenTransfer[1], asset: tokenTransfer[2].toUpperCase(), tokenContract: tokenTransfer[3], recipient: tokenTransfer[4], purpose: prompt };
    if (recipient && amount) return { kind: "flow", recipient, amount, purpose: prompt, asset: "MON", tokenContract: null };
    return { kind: "clarify", message: "For MON: ‘Send 0.01 MON to 0x…’. For a token: ‘Send 10 USDC token 0xTOKEN_CONTRACT to 0xRECIPIENT’. Flow validates the exact contract before wallet approval." };
  }
  if (lower.length < 12) return { kind: "clarify", message: "Tell me the target outcome and any source URLs or constraints that matter." };
  return { kind: "clarify", message: "I can route cited research, campaign creation, contract bytecode scans, crypto purchases, and Monad payments. Add the concrete target and required inputs." };
}
