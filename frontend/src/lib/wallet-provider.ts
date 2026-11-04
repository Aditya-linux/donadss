export type WalletProvider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  disconnect?: () => Promise<void>;
};

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

let activeProvider: WalletProvider | null = null;

export async function connectWalletProvider(): Promise<WalletProvider> {
  if (activeProvider) return activeProvider;

  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
  if (projectId) {
    const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
    const provider = await EthereumProvider.init({
      projectId,
      chains: [10143],
      optionalChains: [10143],
      showQrModal: true,
      rpcMap: { 10143: "https://testnet-rpc.monad.xyz" },
      metadata: {
        name: "DONADS",
        description: "Coordinated AI specialists for verifiable tasks on Monad",
        url: window.location.origin,
        icons: [`${window.location.origin}/brand/donads-mascot.jpeg`],
      },
    });
    await provider.connect();
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
