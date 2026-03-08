import { WalletState, WalletActions } from "../hooks/useWallet";

interface HeaderProps extends WalletState, Pick<WalletActions, "connect" | "disconnect"> {}

export default function Header({ status, address, walletName, error, connect, disconnect }: HeaderProps) {
  const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <header className="header">
      <div className="header-left">
        <span className="logo">Aries Markets</span>
        <span className="logo-sub">備用介面</span>
      </div>

      <div className="header-right">
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
