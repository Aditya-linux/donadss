import { encodeFunctionData, getAddress } from "viem";
import { disconnect, getAccount } from "@wagmi/core";

import { MONAD_TESTNET } from "@/lib/chain-config";
import { wagmiConfig } from "@/lib/wallet-config";

export type WalletProvider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  disconnect?: () => Promise<void>;
};

let activeProvider: WalletProvider | null = null;
let walletChooser: (() => void) | undefined;

export function walletConnectionMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/missing or invalid request\(\) chainid|eip155:10143|unsupported chain|unsupported network|chain.?id/i.test(message)) {
    return "This wallet cannot use Monad Testnet yet. Choose a Monad-compatible wallet, or add Monad Testnet (chain 10143) before trying the transaction again.";
  }
  if (/user rejected|user denied|request rejected|rejected by user/i.test(message)) return "Wallet approval was declined. Nothing was signed or sent.";
  if (/not connected|connector.*not connected/i.test(message)) return "Connect MetaMask, Phantom, or another installed EVM wallet first.";
  return message;
}

export function registerWalletChooser(opener: (() => void) | undefined): () => void {
  walletChooser = opener;
  return () => {
    if (walletChooser === opener) walletChooser = undefined;
  };
}

export function openWalletChooser(): void {
  if (!walletChooser) throw new Error("The wallet chooser is still loading. Try again in a moment.");
  walletChooser();
}

export function monToWeiHex(value: string): string {
  const match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(value.trim());
  if (!match) throw new Error("MON amount must be a positive decimal with at most 18 decimal places.");
  const fraction = (match[2] ?? "").padEnd(18, "0");
  const wei = BigInt(match[1]) * BigInt(10) ** BigInt(18) + BigInt(fraction || "0");
  if (wei <= BigInt(0)) throw new Error("MON amount must be greater than zero.");
  return `0x${wei.toString(16)}`;
}

export function erc20TransferData(recipient: string, amountAtomic: string): `0x${string}` {
  return encodeFunctionData({
    abi: [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const,
    functionName: "transfer",
    args: [getAddress(recipient), BigInt(amountAtomic)],
  });
}

export async function ensureMonadTestnet(provider: WalletProvider): Promise<void> {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MONAD_TESTNET.chainIdHex }] });
  } catch (reason) {
    const code = typeof reason === "object" && reason !== null && "code" in reason
      ? Number((reason as { code: unknown }).code)
      : 0;
    if (code !== 4902) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (/chainid|chain id|unsupported chain|unsupported network/i.test(message)) throw new Error("This wallet did not approve Monad Testnet. Add Monad Testnet in the wallet, reconnect, or use MetaMask for testnet transactions.");
      throw reason;
    }
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: MONAD_TESTNET.chainIdHex,
        chainName: MONAD_TESTNET.name,
        nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
        rpcUrls: [MONAD_TESTNET.rpcUrl],
        blockExplorerUrls: [MONAD_TESTNET.explorerUrl],
      }],
    });
  }
}

export async function requestWalletAccountSelection(provider: WalletProvider): Promise<void> {
  try {
    await provider.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
  } catch (reason) {
    const code = typeof reason === "object" && reason !== null && "code" in reason
      ? Number((reason as { code: unknown }).code)
      : 0;
    const message = reason instanceof Error ? reason.message : String(reason);
    // EIP-2255 is not implemented by every injected wallet. In that case,
    // eth_requestAccounts remains the standards-compatible fallback. A real
    // user rejection must still stop the switch.
    if (code === -32601 || code === 4200 || /unsupported|not implemented|method not found/i.test(message)) return;
    throw reason;
  }
}

export async function connectWalletProvider(): Promise<WalletProvider> {
  if (activeProvider) return activeProvider;
  const account = getAccount(wagmiConfig);
  if (!account.isConnected || !account.connector) throw new Error("Wallet connector is not connected.");
  const provider = await account.connector.getProvider();
  if (!provider || typeof provider !== "object" || !("request" in provider) || typeof provider.request !== "function") {
    throw new Error("The connected wallet did not expose an EVM provider.");
  }
  activeProvider = provider as WalletProvider;
  return activeProvider;
}

export function getConnectedWalletProvider(): WalletProvider | null {
  return activeProvider;
}

export async function disconnectWalletProvider(): Promise<void> {
  activeProvider = null;
  await disconnect(wagmiConfig);
}
