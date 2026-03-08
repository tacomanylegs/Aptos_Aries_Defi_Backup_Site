import { useState, useCallback } from "react";
import Header from "./components/Header";
import Dashboard from "./components/Dashboard";
import TransactionModal from "./components/TransactionModal";
import PasswordGate from "./components/PasswordGate";
import { useWallet } from "./hooks/useWallet";
import { buildClaimRewardsPayload, TxPayload } from "./lib/aries";
import { USDT_COIN_TYPE, DEFAULT_PROFILES } from "./config";

type ModalState = {
  open: boolean;
  mode: "deposit" | "withdraw";
  profileName: string;
  coinType: string;
  maxAmount: number;
};

function AuthedApp() {
  const wallet = useWallet();

  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: "deposit",
    profileName: DEFAULT_PROFILES[0],
    coinType: USDT_COIN_TYPE,
    maxAmount: 0,
  });

  const openDeposit = (profileName: string, coinType: string) => {
    setModal({ open: true, mode: "deposit", profileName, coinType, maxAmount: 0 });
  };

  const openWithdraw = (profileName: string, coinType: string, maxAmount: number) => {
    setModal({ open: true, mode: "withdraw", profileName, coinType, maxAmount });
  };

  const closeModal = () => {
    setModal((s) => ({ ...s, open: false }));
  };

  const handleTx = async (payload: TxPayload): Promise<string> => {
    return wallet.signAndSubmit(payload);
  };

  const handleClaim = async (profileName: string, rewardCoinType: string): Promise<string> => {
    return handleTx(buildClaimRewardsPayload(profileName, rewardCoinType));
  };

  return (
    <div className="app">
      <Header
        status={wallet.status}
        address={wallet.address}
        publicKey={wallet.publicKey}
        error={wallet.error}
        walletName={wallet.walletName}
        connect={wallet.connect}
        disconnect={wallet.disconnect}
      />

      <main className="main">
        {wallet.status !== "connected" ? (
          <div className="connect-prompt">
            <div className="connect-card">
              <h2>Aries Markets 備用介面</h2>
              <p>
                直接與 Aptos 鏈上智能合約互動，<br />
                繞過 API 限速問題存取你的存款。
              </p>
              <div className="feature-list">
                <div className="feature">📊 查詢存款餘額和 APR</div>
                <div className="feature">💰 存入 USDT / USDC</div>
                <div className="feature">💸 取出存款</div>
                <div className="feature">🎁 領取 APT 獎勵</div>
                <div className="feature">🔄 多節點自動輪換，避免限速</div>
              </div>
              <button
                className="btn btn-primary btn-lg"
                onClick={wallet.connect}
                disabled={wallet.status === "connecting"}
              >
                {wallet.status === "connecting" ? "⏳ 連接中..." : "連接 Petra / Martian 錢包"}
              </button>
              {wallet.error && (
                <div className="alert alert-error mt-2">
                  ⚠️ {wallet.error}
                  <br />
                  <small>
                    請安裝{" "}
                    <a href="https://petra.app/" target="_blank" rel="noopener noreferrer">
                      Petra Wallet
                    </a>{" "}
                    瀏覽器擴充功能
                  </small>
                </div>
              )}
              <div className="contract-info">
                <small>
                  合約地址:{" "}
                  <code>0x9770fa9c...dbaa66</code>
                  <br />
                  資料直接從 Aptos 主網讀取，無需依賴官方 API
                </small>
              </div>
            </div>
          </div>
        ) : (
          <Dashboard
            userAddress={wallet.address!}
            onDeposit={openDeposit}
            onWithdraw={openWithdraw}
            onClaim={handleClaim}
          />
        )}
      </main>

      {modal.open && (
        <TransactionModal
          mode={modal.mode}
          defaultProfile={modal.profileName}
          defaultCoinType={modal.coinType}
          defaultMaxAmount={modal.maxAmount}
          onSubmit={handleTx}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const handleAuth = useCallback(() => setAuthed(true), []);

  if (!authed) return <PasswordGate onAuth={handleAuth} />;

  return <AuthedApp />;
}

