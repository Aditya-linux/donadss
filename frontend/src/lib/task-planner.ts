export type UnifiedPlan =
  | { kind: "scout"; prompt: string }
  | { kind: "sentinel"; bytecode: string }
  | { kind: "growth"; objective: string }
  | { kind: "operator"; objective: string; sources: string[] }
  | { kind: "clarify"; message: string };

function urlsIn(value: string): string[] {
  return [...new Set(value.match(/https?:\/\/[^\s<>"']+/gi)?.map((url) => url.replace(/[),.;!?]+$/g, "")) ?? [])];
}

export function planUnifiedTask(rawPrompt: string): UnifiedPlan {
  const prompt = rawPrompt.trim();
  const lower = prompt.toLowerCase();
  const urls = urlsIn(prompt);
  const bytecode = prompt.match(/0x[0-9a-fA-F]{4,}/)?.[0];

  if (!prompt) return { kind: "clarify", message: "Describe the outcome you want DONADS to complete." };
  if (bytecode && /(audit|scan|bytecode|contract|security|risk)/i.test(prompt)) return { kind: "sentinel", bytecode };

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
  if (/(pay|send|transfer)/i.test(prompt)) {
    return { kind: "clarify", message: "Send the Monad recipient address, exact MON amount, and payment purpose. Flow will prepare the intent and your wallet will show the final confirmation." };
  }
  if (lower.length < 12) return { kind: "clarify", message: "Tell me the target outcome and any source URLs or constraints that matter." };
  return { kind: "clarify", message: "I can route cited research, campaign creation, contract bytecode scans, crypto purchases, and Monad payments. Add the concrete target and required inputs." };
}
