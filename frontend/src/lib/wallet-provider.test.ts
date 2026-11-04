import { beforeEach, describe, expect, it, vi } from "vitest";

const wagmiMocks = vi.hoisted(() => ({ disconnect: vi.fn(), getAccount: vi.fn() }));

vi.mock("@wagmi/core", () => ({
  disconnect: wagmiMocks.disconnect,
  getAccount: wagmiMocks.getAccount,
}));

vi.mock("@/lib/wallet-config", () => ({ wagmiConfig: {} }));

import { connectWalletProvider, disconnectWalletProvider, ensureMonadTestnet, openWalletChooser, registerWalletChooser, requestWalletAccountSelection, walletConnectionMessage } from "./wallet-provider";

describe("RainbowKit wallet lifecycle", () => {
  beforeEach(async () => {
    wagmiMocks.disconnect.mockReset().mockResolvedValue(undefined);
    wagmiMocks.getAccount.mockReset();
    await disconnectWalletProvider();
  });

  it("uses the EIP-1193 provider selected by the active Wagmi connector", async () => {
    const provider = { request: vi.fn(async () => []) };
    wagmiMocks.getAccount.mockReturnValue({ isConnected: true, connector: { getProvider: vi.fn(async () => provider) } });

    await expect(connectWalletProvider()).resolves.toBe(provider);
  });

  it("fails clearly when no RainbowKit wallet is connected", async () => {
    wagmiMocks.getAccount.mockReturnValue({ isConnected: false, connector: undefined });
    await expect(connectWalletProvider()).rejects.toThrow("Wallet connector is not connected");
  });

  it("opens the registered RainbowKit chooser without creating a QR lifecycle", () => {
    const open = vi.fn();
    const unregister = registerWalletChooser(open);

    openWalletChooser();
    expect(open).toHaveBeenCalledOnce();
    unregister();
  });

  it("disconnects through Wagmi and clears the selected provider", async () => {
    await disconnectWalletProvider();
    expect(wagmiMocks.disconnect).toHaveBeenCalled();
  });
});

describe("Monad network enforcement", () => {
  it("translates chain namespace errors into a recoverable Monad message", () => {
    expect(walletConnectionMessage(new Error("Missing or invalid request() chainId: eip155:10143"))).toMatch(/Monad-compatible wallet.*chain 10143/i);
  });

  it("explains when a connected wallet did not approve Monad Testnet", async () => {
    const provider = {
      request: vi.fn(async () => { throw new Error("Missing or invalid request() chainId: eip155:10143"); }),
    };

    await expect(ensureMonadTestnet(provider)).rejects.toThrow("This wallet did not approve Monad Testnet");
  });

  it("adds Monad Testnet when the wallet reports an unknown chain", async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("Unknown chain"), { code: 4902 }))
      .mockResolvedValueOnce(undefined);

    await expect(ensureMonadTestnet({ request })).resolves.toBeUndefined();
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ method: "wallet_addEthereumChain" }));
  });
});

describe("wallet account selection", () => {
  it("requests a fresh injected-wallet account permission", async () => {
    const request = vi.fn(async () => [{ parentCapability: "eth_accounts" }]);
    await expect(requestWalletAccountSelection({ request })).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
  });

  it("falls back when a wallet does not implement permission selection", async () => {
    const request = vi.fn(async () => { throw Object.assign(new Error("Method not found"), { code: -32601 }); });
    await expect(requestWalletAccountSelection({ request })).resolves.toBeUndefined();
  });

  it("preserves an explicit user rejection", async () => {
    const rejection = Object.assign(new Error("User rejected"), { code: 4001 });
    const request = vi.fn(async () => { throw rejection; });
    await expect(requestWalletAccountSelection({ request })).rejects.toBe(rejection);
  });
});
