import { describe, expect, it, vi } from "vitest";

import { connectWalletConnectProvider, WalletConnectionCancelledError } from "./wallet-provider";

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
      connect: vi.fn(async () => undefined),
      session: { topic: "connected" },
      modal: { subscribeState: vi.fn(() => unsubscribe) },
    };

    await expect(connectWalletConnectProvider(provider)).resolves.toBeUndefined();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
