export type WalletProvider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  disconnect?: () => Promise<void>;
};

import { MONAD_TESTNET } from "@/lib/chain-config";

type WalletConnectProvider = WalletProvider & {
  connect(): Promise<void>;
  session?: unknown;
  modal?: {
    close?: () => Promise<void> | void;
    subscribeState?: (callback: (state: { open?: boolean }) => void) => (() => void) | void;
  };
};

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

let activeProvider: WalletProvider | null = null;

const WALLET_CONNECT_TIMEOUT_MS = 120_000;

export class WalletConnectionCancelledError extends Error {
  constructor(message = "Wallet connection cancelled.") {
    super(message);
    this.name = "WalletConnectionCancelledError";
  }
}

export async function connectWalletConnectProvider(provider: WalletConnectProvider): Promise<void> {
  if (provider.session) return;

  let modalWasOpened = false;
  let unsubscribe: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const cancelled = new Promise<never>((_, reject) => {
    const subscription = provider.modal?.subscribeState?.((state) => {
      if (state.open) {
        modalWasOpened = true;
        return;
      }
      if (modalWasOpened && !provider.session) reject(new WalletConnectionCancelledError());
    });
    if (typeof subscription === "function") unsubscribe = subscription;

    timeout = setTimeout(
      () => reject(new WalletConnectionCancelledError("Wallet connection timed out. Please try again.")),
      WALLET_CONNECT_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([provider.connect(), cancelled]);
  } catch (error) {
    // AppKit teardown can outlive the cancelled connection. Start cleanup, but
    // never keep the DONADS loading screen blocked on a third-party modal.
    try { void provider.disconnect?.().catch(() => undefined); } catch { /* no session to clean up */ }
    try { void Promise.resolve(provider.modal?.close?.()).catch(() => undefined); } catch { /* modal is already closed */ }
    if (error instanceof WalletConnectionCancelledError) throw error;
    if (error instanceof Error && /connection request reset|user (?:closed|rejected|disconnected)|cancel/i.test(error.message)) {
      throw new WalletConnectionCancelledError();
    }
    throw error;
  } finally {
    unsubscribe?.();
    if (timeout) clearTimeout(timeout);
  }
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

export async function connectWalletProvider(): Promise<WalletProvider> {
  if (activeProvider) return activeProvider;

  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
  if (projectId) {
    const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
    const provider = await EthereumProvider.init({
      projectId,
      chains: [1],
      optionalChains: [10143],
      showQrModal: true,
      rpcMap: { 1: "https://cloudflare-eth.com", 10143: MONAD_TESTNET.rpcUrl },
      metadata: {
        name: "DONADS",
        description: "Coordinated AI specialists for verifiable tasks on Monad",
        url: window.location.origin,
        icons: [`${window.location.origin}/brand/donads-mascot-tile.png`],
      },
    });
    if (provider.session) {
      activeProvider = provider as WalletProvider;
      return activeProvider;
    }
    await connectWalletConnectProvider(provider as WalletConnectProvider);
    activeProvider = provider as WalletProvider;
    return activeProvider;
  }

  if (window.ethereum) {
    activeProvider = window.ethereum;
    return activeProvider;
  }
  throw new Error("Wallet connection is not configured. Add a Reown project ID or install an EVM wallet.");
}

export function getConnectedWalletProvider(): WalletProvider | null {
  return activeProvider ?? (typeof window === "undefined" ? null : window.ethereum ?? null);
}

export async function disconnectWalletProvider(): Promise<void> {
  const provider = activeProvider;
  activeProvider = null;
  await provider?.disconnect?.();
}
import { encodeFunctionData, getAddress } from "viem";
