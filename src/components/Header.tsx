import { useState, useEffect } from "react";
import { WalletState, WalletActions } from "../hooks/useWallet";
import { APTOS_NODES, currentNodeIndex, setNodeIndex } from "../config";

interface HeaderProps extends WalletState, Pick<WalletActions, "connect" | "disconnect"> {}

export default function Header({ status, address, walletName, error, connect, disconnect }: HeaderProps) {
  const [rpcIndex, setRpcIndex] = useState(currentNodeIndex);

  useEffect(() => {
    const handleRpcChange = () => setRpcIndex(currentNodeIndex);
    window.addEventListener("rpcNodeChanged", handleRpcChange as EventListener);
    return () => window.removeEventListener("rpcNodeChanged", handleRpcChange as EventListener);
  }, []);

  const handleRpcChangeFn = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNodeIndex(Number(e.target.value));
  };

  const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <header className="header">
      <div className="header-left">
        <span className="logo">Aries Markets</span>
        <span className="logo-sub">備用介面</span>
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="rpc-selector-container" title="選擇 Aptos RPC 節點">
          <select 
            value={rpcIndex} 
            onChange={handleRpcChangeFn}
            style={{ padding: '0.4rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            {APTOS_NODES.map((node, i) => {
              try {
                const url = new URL(node);
                return <option key={i} value={i}>{url.hostname}</option>;
              } catch {
                return <option key={i} value={i}>RPC {i + 1}</option>;
              }
            })}
          </select>
        </div>

        {status === "connected" && address ? (
          <div className="wallet-info">
            <span className="wallet-badge">
              🟢 {walletName} · {shortAddr(address)}
            </span>
            <button className="btn btn-sm btn-outline" onClick={disconnect}>
              斷開
            </button>
          </div>
        ) : status === "connecting" ? (
          <button className="btn btn-primary" disabled>
            ⏳ 連接中...
          </button>
        ) : (
          <button className="btn btn-primary" onClick={connect}>
            連接錢包
          </button>
        )}

        {status === "error" && error && (
          <div className="header-error">⚠️ {error}</div>
        )}
      </div>
    </header>
  );
}
