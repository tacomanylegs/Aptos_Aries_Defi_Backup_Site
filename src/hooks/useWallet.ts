/**
 * Petra / Martian / Pontem 錢包連接 Hook
 * 直接使用 window.aptos 注入的 API（無需額外 SDK）
 */

import { useState, useEffect, useCallback } from "react";
import { TxPayload } from "../lib/aries";
import { waitForTransaction } from "../lib/aptos";
import { EXPLORER_URL } from "../config";

export type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WalletState {
  status: WalletStatus;
  address: string | null;
  publicKey: string | null;
  error: string | null;
  walletName: string | null;
}

export interface WalletActions {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSubmit: (payload: TxPayload) => Promise<string>;
}

/** Petra wallet 注入的 window API 類型 */
interface AptosWalletAPI {
  connect(): Promise<{ address: string; publicKey: string }>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  account(): Promise<{ address: string; publicKey: string }>;
  signAndSubmitTransaction(payload: TxPayload): Promise<{ hash: string }>;
  network(): Promise<{ name: string; chainId: string }>;
  onAccountChange(callback: (account: { address: string }) => void): void;
  onNetworkChange(callback: (network: { name: string }) => void): void;
}

declare global {
  interface Window {
    aptos?: AptosWalletAPI;      // Petra
    martian?: AptosWalletAPI;    // Martian
    pontem?: AptosWalletAPI;     // Pontem
  }
}

/**
 * 偵測可用的錢包
 */
function detectWallet(): { api: AptosWalletAPI; name: string } | null {
  if (window.aptos) return { api: window.aptos, name: "Petra" };
  if (window.martian) return { api: window.martian, name: "Martian" };
  if (window.pontem) return { api: window.pontem, name: "Pontem" };
  return null;
}

export function useWallet(): WalletState & WalletActions {
  const [state, setState] = useState<WalletState>({
    status: "disconnected",
    address: null,
    publicKey: null,
    error: null,
    walletName: null,
  });

  // 頁面載入時檢查是否已連接
  useEffect(() => {
    const check = async () => {
      const wallet = detectWallet();
      if (!wallet) return;

      try {
        const connected = await wallet.api.isConnected();
        if (connected) {
          const account = await wallet.api.account();
          setState({
            status: "connected",
            address: account.address,
            publicKey: account.publicKey,
            error: null,
            walletName: wallet.name,
          });
        }
      } catch {
        // 未連接，忽略錯誤
      }
    };

    check();
  }, []);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, status: "connecting", error: null }));

    const wallet = detectWallet();
    if (!wallet) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "未偵測到 Aptos 錢包。請安裝 Petra 或 Martian 瀏覽器擴充功能。",
      }));
      return;
    }

    try {
      const account = await wallet.api.connect();
      setState({
        status: "connected",
        address: account.address,
        publicKey: account.publicKey,
        error: null,
        walletName: wallet.name,
      });

      // 監聽帳戶變更
      wallet.api.onAccountChange?.((newAccount) => {
        setState((s) => ({
          ...s,
          address: newAccount.address,
        }));
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "連接錢包失敗";
      setState((s) => ({ ...s, status: "error", error: msg }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    const wallet = detectWallet();
    if (wallet) {
      try {
        await wallet.api.disconnect();
      } catch {
        // 忽略斷開錯誤
      }
    }
    setState({
      status: "disconnected",
      address: null,
      publicKey: null,
      error: null,
      walletName: null,
    });
  }, []);

  const signAndSubmit = useCallback(async (payload: TxPayload): Promise<string> => {
    const wallet = detectWallet();
    if (!wallet) throw new Error("未連接錢包");
    if (state.status !== "connected") throw new Error("請先連接錢包");

    const result = await wallet.api.signAndSubmitTransaction(payload);
    const txHash = result.hash;

    // 等待交易確認
    await waitForTransaction(txHash);

    return txHash;
  }, [state.status]);

  return {
    ...state,
    connect,
    disconnect,
    signAndSubmit,
  };
}

/**
 * 取得 Aptos Explorer 交易連結
 */
export function getTxExplorerUrl(txHash: string): string {
  return `${EXPLORER_URL}/txn/${txHash}?network=mainnet`;
}

/**
 * 取得 Aptos Explorer 帳號連結
 */
export function getAccountExplorerUrl(address: string): string {
  return `${EXPLORER_URL}/account/${address}?network=mainnet`;
}
