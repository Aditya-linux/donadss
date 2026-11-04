import { describe, expect, it, vi } from "vitest";

import { connectWalletConnectProvider, ensureMonadTestnet, WalletConnectionCancelledError } from "./wallet-provider";

describe("WalletConnect lifecycle", () => {
  it("rejects immediately and cleans up when the QR modal is closed", async () => {
    let onState: ((state: { open?: boolean }) => void) | undefined;
    const unsubscribe = vi.fn();
    const disconnect = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const provider = {
      request: vi.fn(),
      connect: vi.fn(() => new Promise<void>(() => undefined)),
      disconnect,
      modal: {
        close,
        subscribeState(callback: (state: { open?: boolean }) => void) {
          onState = callback;
          return unsubscribe;
        },
      },
    };

    const connection = connectWalletConnectProvider(provider);
    onState?.({ open: true });
    onState?.({ open: false });

    await expect(connection).rejects.toBeInstanceOf(WalletConnectionCancelledError);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("completes normally when the provider creates a session", async () => {
    const unsubscribe = vi.fn();
    const provider = {
      request: vi.fn(),
      connect: vi.fn(async () => { provider.session = { topic: "connected" }; }),
      session: undefined as { topic: string } | undefined,
      modal: { subscribeState: vi.fn(() => unsubscribe) },
    };

    await expect(connectWalletConnectProvider(provider)).resolves.toBeUndefined();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("reuses an existing WalletConnect session without opening a new QR request", async () => {
    const provider = {
      request: vi.fn(),
      connect: vi.fn(async () => undefined),
      session: { topic: "persisted-session" },
      modal: { subscribeState: vi.fn() },
    };

    await expect(connectWalletConnectProvider(provider)).resolves.toBeUndefined();
    expect(provider.connect).not.toHaveBeenCalled();
    expect(provider.modal.subscribeState).not.toHaveBeenCalled();
  });

  it("returns cancellation immediately even if third-party cleanup does not settle", async () => {
    let onState: ((state: { open?: boolean }) => void) | undefined;
    const provider = {
      request: vi.fn(),
      connect: vi.fn(() => new Promise<void>(() => undefined)),
      disconnect: vi.fn(() => new Promise<void>(() => undefined)),
      modal: {
        close: vi.fn(() => new Promise<void>(() => undefined)),
        subscribeState(callback: (state: { open?: boolean }) => void) { onState = callback; },
      },
    };

    const connection = connectWalletConnectProvider(provider);
    onState?.({ open: true });
    onState?.({ open: false });

    await expect(connection).rejects.toBeInstanceOf(WalletConnectionCancelledError);
    expect(provider.disconnect).toHaveBeenCalledOnce();
    expect(provider.modal.close).toHaveBeenCalledOnce();
  });
});

describe("Monad network enforcement", () => {
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
