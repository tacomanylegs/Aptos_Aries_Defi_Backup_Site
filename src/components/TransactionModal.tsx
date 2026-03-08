import { useState } from "react";
import { SUPPORTED_ASSETS, DEFAULT_PROFILES } from "../config";
import {
  buildDepositPayload,
  buildWithdrawPayload,
  TxPayload,
} from "../lib/aries";
import { getTxExplorerUrl } from "../hooks/useWallet";

interface TransactionModalProps {
  mode: "deposit" | "withdraw";
  defaultProfile: string;
  defaultCoinType: string;
  defaultMaxAmount?: number;
  onSubmit: (payload: TxPayload) => Promise<string>;
  onClose: () => void;
}

export default function TransactionModal({
  mode,
  defaultProfile,
  defaultCoinType,
  defaultMaxAmount = 0,
  onSubmit,
  onClose,
}: TransactionModalProps) {
  const asset = SUPPORTED_ASSETS.find((a) => a.coinType === defaultCoinType) ?? SUPPORTED_ASSETS[0];

  const [profileName, setProfileName] = useState(defaultProfile);
  const [selectedCoinType, setSelectedCoinType] = useState(asset.coinType);
  const [amountStr, setAmountStr] = useState("");
  const [withdrawAll, setWithdrawAll] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedAsset = SUPPORTED_ASSETS.find((a) => a.coinType === selectedCoinType) ?? SUPPORTED_ASSETS[0];

  const parseAmount = (): bigint | null => {
    const num = parseFloat(amountStr);
    if (isNaN(num) || num <= 0) return null;
    return BigInt(Math.floor(num * 10 ** selectedAsset.decimals));
  };

  const handleSubmit = async () => {
    setStatus("pending");
    setErrorMsg(null);

    try {
      let payload: TxPayload;

      if (mode === "deposit") {
        const amount = parseAmount();
        if (!amount) {
          setErrorMsg("請輸入有效金額");
          setStatus("error");
          return;
        }
        payload = buildDepositPayload(profileName, selectedCoinType, amount);
      } else {
        const amount = withdrawAll ? null : parseAmount();
        if (!withdrawAll && !amount) {
          setErrorMsg("請輸入有效金額或勾選「取出全部」");
          setStatus("error");
          return;
        }
        payload = buildWithdrawPayload(profileName, selectedCoinType, amount, false);
      }

      const hash = await onSubmit(payload);
      setTxHash(hash);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "交易失敗");
      setStatus("error");
    }
  };

  const isSubmitting = status === "pending";
  const title = mode === "deposit" ? "存入資產" : "取出資產";

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {status === "success" ? (
            <div className="success-state">
              <div className="success-icon">✅</div>
              <p className="success-title">交易成功！</p>
              <a
                href={getTxExplorerUrl(txHash!)}
                target="_blank"
                rel="noopener noreferrer"
                className="link-primary"
              >
                在 Explorer 查看交易 ↗
              </a>
              <br />
              <code className="tx-hash">{txHash}</code>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={onClose}>
                  關閉
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Profile 選擇 */}
              <div className="form-group">
                <label className="form-label">Profile（借貸帳戶）</label>
                <select
                  className="form-select"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  disabled={isSubmitting}
                >
                  {DEFAULT_PROFILES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="custom">自訂...</option>
                </select>
                {profileName === "custom" && (
                  <input
                    type="text"
                    className="form-input mt-1"
                    placeholder="輸入 Profile 名稱"
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                )}
              </div>

              {/* 幣種選擇 */}
              <div className="form-group">
                <label className="form-label">幣種</label>
                <select
                  className="form-select"
                  value={selectedCoinType}
                  onChange={(e) => setSelectedCoinType(e.target.value)}
                  disabled={isSubmitting}
                >
                  {SUPPORTED_ASSETS.map((a) => (
                    <option key={a.coinType} value={a.coinType}>
                      {a.icon} {a.symbol} - {a.name}
                    </option>
                  ))}
                </select>
                <small className="form-hint text-muted">
                  合約類型: {selectedCoinType}
                </small>
              </div>

              {/* 金額輸入 */}
              {mode === "withdraw" && (
                <div className="form-group">
                  <label className="form-check">
                    <input
                      type="checkbox"
                      checked={withdrawAll}
                      onChange={(e) => setWithdrawAll(e.target.checked)}
                      disabled={isSubmitting}
                    />
                    <span>取出全部（最大金額）</span>
                  </label>
                </div>
              )}

              {!withdrawAll && (
                <div className="form-group">
                  <label className="form-label">金額（{selectedAsset.symbol}）</label>
                  <div className="input-row">
                    <input
                      type="number"
                      className="form-input"
                      placeholder={`例如: 100`}
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      min="0"
                      step="0.000001"
                      disabled={isSubmitting}
                    />
                    {mode === "withdraw" && defaultMaxAmount > 0 && (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() =>
                          setAmountStr(defaultMaxAmount.toFixed(selectedAsset.decimals))
                        }
                        disabled={isSubmitting}
                      >
                        MAX
                      </button>
                    )}
                  </div>
                  {amountStr && (
                    <small className="form-hint">
                      = {(parseFloat(amountStr) * 10 ** selectedAsset.decimals).toFixed(0)} 最小單位
                    </small>
                  )}
                </div>
              )}

              {/* 交易資訊預覽 */}
              <div className="tx-preview">
                <p className="preview-title">交易預覽</p>
                <div className="preview-row">
                  <span>函數</span>
                  <code className="preview-value small">
                    controller::{mode === "deposit" ? "deposit_fa" : "withdraw_fa"}
                  </code>
                </div>
                <div className="preview-row">
                  <span>Profile</span>
                  <code className="preview-value">{profileName}</code>
                </div>
                <div className="preview-row">
                  <span>幣種</span>
                  <code className="preview-value small">{selectedAsset.symbol}</code>
                </div>
                {mode === "withdraw" && (
                  <div className="preview-row">
                    <span>allow_borrow</span>
                    <code className="preview-value">false</code>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="alert alert-error">⚠️ {errorMsg}</div>
              )}

              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  取消
                </button>
                <button
                  className={`btn ${mode === "deposit" ? "btn-primary" : "btn-danger"}`}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "⏳ 送出中..."
                    : mode === "deposit"
                    ? "確認存入"
                    : "確認取款"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
