import { useState, useEffect, useCallback } from "react";
import {
  getAccountSummary,
  getAllReserveSummaries,
  AccountSummary,
  ReserveSummary,
} from "../lib/aries";
import { SUPPORTED_ASSETS, APT_COIN_TYPE } from "../config";
import { getAccountExplorerUrl, getTxExplorerUrl } from "../hooks/useWallet";
import { getAptPriceUsd } from "../lib/market";

interface DashboardProps {
  userAddress: string;
  onDeposit: (profileName: string, coinType: string) => void;
  onWithdraw: (profileName: string, coinType: string, maxAmount: number) => void;
  onClaim: (profileName: string, rewardCoinType: string) => Promise<string>;
}

export default function Dashboard({ userAddress, onDeposit, onWithdraw, onClaim }: DashboardProps) {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [reserves, setReserves] = useState<ReserveSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [aptPriceUsd, setAptPriceUsd] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!userAddress) return;
    setLoading(true);
    setError(null);

    try {
      const [summaryData, reserveData, aptPrice] = await Promise.all([
        getAccountSummary(userAddress, SUPPORTED_ASSETS),
        getAllReserveSummaries(SUPPORTED_ASSETS),
        getAptPriceUsd().catch(() => null),
      ]);
      setSummary(summaryData);
      setReserves(reserveData);
      if (aptPrice) {
        setAptPriceUsd(aptPrice);
      }
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "查詢失敗");
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const shortAddr = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatAmount = (amount: number, symbol: string) =>
    `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${symbol}`;

  const formatRewardAmount = (amount: number, symbol: string) =>
    `${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })} ${symbol}`;

  const formatUsd = (amount: number) =>
    `~$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatAPR = (apr: number) =>
    `${apr.toFixed(2)}%`;

  const calcDailyEarning = (amount: number, apr: number) =>
    amount * (apr / 100) / 365;

  const formatDailyEarning = (amount: number) =>
    `~$${amount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

  const formatPercent = (rate: number) =>
    `${(rate * 100).toFixed(1)}%`;

  const formatLarge = (amount: number) => {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`;
    return `$${amount.toFixed(2)}`;
  };

  const handleClaim = async (profileName: string, rewardCoinType: string) => {
    const key = `${profileName}:${rewardCoinType}`;
    setClaimingKey(key);
    setClaimError(null);
    setClaimTxHash(null);

    try {
      const txHash = await onClaim(profileName, rewardCoinType);
      setClaimTxHash(txHash);
      await refresh();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Claim 失敗");
    } finally {
      setClaimingKey(null);
    }
  };

  return (
    <div className="dashboard">
      {/* 帳號資訊 */}
      <div className="card">
        <div className="card-header">
          <h2>帳號</h2>
          <a
            href={getAccountExplorerUrl(userAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="link-small"
          >
            {shortAddr(userAddress)} ↗
          </a>
        </div>
      </div>

      {/* 重新整理按鈕 */}
      <div className="refresh-row">
        <button
          onClick={refresh}
          disabled={loading}
          className="btn btn-secondary"
        >
          {loading ? "⏳ 查詢中..." : "🔄 重新整理"}
        </button>
        {lastRefresh && (
          <span className="text-muted">
            最後更新：{lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          ⚠️ {error}
          <br />
          <small>若為限速問題，系統會自動切換節點，請再試一次。</small>
        </div>
      )}

      {claimError && (
        <div className="alert alert-error">
          ⚠️ {claimError}
        </div>
      )}

      {claimTxHash && (
        <div className="alert alert-success">
          Claim 交易已確認。
          {" "}
          <a
            href={getTxExplorerUrl(claimTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="link-primary"
          >
            在 Explorer 查看 ↗
          </a>
        </div>
      )}

      {/* 市場概覽（Reserve 資料） */}
      <section className="section">
        <h3 className="section-title">市場概覽</h3>
        {reserves.length === 0 && !loading && (
          <p className="text-muted">暫無資料</p>
        )}
        <div className="reserve-grid">
          {reserves.map((r) => (
            <div key={r.coinType} className="reserve-card">
              <div className="reserve-header">
                <span className="coin-symbol">{r.symbol}</span>
              </div>
              <div className="reserve-stats">
                <div className="stat">
                  <span className="stat-label">存款年利率</span>
                  <span className="stat-value green">{formatAPR(r.supplyAPR)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">借款年利率</span>
                  <span className="stat-value orange">{formatAPR(r.borrowAPR)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">總存款</span>
                  <span className="stat-value">{formatLarge(r.totalDeposited)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">使用率</span>
                  <span className="stat-value">{formatPercent(r.utilizationRate)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 我的存款 */}
      <section className="section">
        <h3 className="section-title">我的存款</h3>

        {!summary && !loading && (
          <p className="text-muted">點擊重新整理查詢存款狀態</p>
        )}

        {summary && summary.profiles.length === 0 && (
          <p className="text-muted">此帳號尚未在 Aries Markets 建立存款</p>
        )}

        {summary?.profiles.map((profile) => (
          <div key={profile.name} className="card profile-card">
            {(() => {
              const aptRewards = profile.claimableRewards.filter(
                (reward) => reward.coinType === APT_COIN_TYPE || reward.symbol === "APT"
              );
              const totalAptReward = aptRewards.reduce((sum, reward) => sum + reward.amount, 0);
              const totalAptRewardUsd = aptPriceUsd ? totalAptReward * aptPriceUsd : null;

              return (
                <>
            <div className="profile-header">
              <div>
                <span className="profile-name">{profile.name}</span>
                <a
                  href={getAccountExplorerUrl(profile.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-small ml-2"
                >
                  {shortAddr(profile.address)} ↗
                </a>
              </div>
            </div>

            {profile.deposits.length === 0 ? (
              <p className="text-muted">此 Profile 無存款</p>
            ) : (
              <div className="deposits-table">
                <div className="deposits-header">
                  <span>幣種</span>
                  <span>存款金額</span>
                  <span>存款份額</span>
                  <span>年利率</span>
                  <span>每日收益</span>
                  <span>操作</span>
                </div>
                {profile.deposits.map((dep) => (
                  <div key={dep.coinType} className="deposits-row">
                    <span className="coin-symbol-sm">{dep.symbol}</span>
                    <span>
                      {dep.amount > 0
                        ? formatAmount(dep.amount, dep.symbol)
                        : `${BigInt(dep.collateral_amount).toLocaleString()} shares`}
                    </span>
                    <span className="text-muted share-small">
                      {BigInt(dep.collateral_amount).toLocaleString()}
                    </span>
                    <span className="green">
                      {dep.supplyAPR > 0 ? formatAPR(dep.supplyAPR) : "—"}
                    </span>
                    <span className="daily-earning">
                      {dep.supplyAPR > 0 && dep.amount > 0
                        ? formatDailyEarning(calcDailyEarning(dep.amount, dep.supplyAPR))
                        : "—"}
                    </span>
                    <div className="action-btns">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => onDeposit(profile.name, dep.coinType)}
                      >
                        存入
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => onWithdraw(profile.name, dep.coinType, dep.amount)}
                      >
                        取款
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 每日收益合計 */}
            {profile.deposits.length > 0 && (() => {
              const totalDaily = profile.deposits.reduce((sum, dep) => {
                if (dep.supplyAPR > 0 && dep.amount > 0) {
                  return sum + calcDailyEarning(dep.amount, dep.supplyAPR);
                }
                return sum;
              }, 0);
              return totalDaily > 0 ? (
                <div className="daily-earning-summary">
                  <span className="daily-earning-icon">💰</span>
                  <span className="daily-earning-label">預估每日收益</span>
                  <span className="daily-earning-total">
                    {formatDailyEarning(totalDaily)} / 天
                  </span>
                </div>
              ) : null;
            })()}

            <div className={`rewards-panel ${profile.claimableRewards.length > 0 ? "rewards-panel-highlight" : ""}`}>
              <div className="rewards-header-row">
                <div>
                  <div className="rewards-eyebrow">重要功能</div>
                  <span className="rewards-title">可領獎勵 / Claim Rewards</span>
                </div>
                {profile.claimableRewards.length > 0 && (
                  <span className="rewards-count">
                    {profile.claimableRewards.length} 種
                  </span>
                )}
              </div>

              {profile.claimableRewards.length === 0 ? (
                <p className="text-muted reward-empty">目前無可領獎勵</p>
              ) : (
                <div className="reward-list">
                  {profile.claimableRewards.map((reward) => {
                    const claimKey = `${profile.name}:${reward.coinType}`;
                    const isClaiming = claimingKey === claimKey;
                    const isAptReward = reward.coinType === APT_COIN_TYPE || reward.symbol === "APT";
                    const rewardUsd = isAptReward && aptPriceUsd ? reward.amount * aptPriceUsd : null;

                    return (
                      <div key={reward.coinType} className={`reward-row ${isAptReward ? "reward-row-apt" : ""}`}>
                        <div className="reward-main">
                          <div className="reward-symbol-row">
                            <div className="reward-symbol">{reward.symbol}</div>
                            {isAptReward && <span className="reward-pill">主要獎勵</span>}
                          </div>
                          <div className="reward-amount">
                            {formatRewardAmount(reward.amount, reward.symbol)}
                          </div>
                          {isAptReward && (
                            <div className="reward-usd">
                              {rewardUsd ? `${formatUsd(rewardUsd)} USDT 左右` : "約當 USDT 讀取中"}
                            </div>
                          )}
                        </div>
                        <button
                          className={`btn ${isAptReward ? "btn-claim-primary" : "btn-sm btn-primary"}`}
                          onClick={() => handleClaim(profile.name, reward.coinType)}
                          disabled={isClaiming}
                        >
                          {isClaiming ? "Claim 中..." : `Claim ${reward.symbol}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Profile 快速存款按鈕 */}
            <div className="profile-actions">
              {SUPPORTED_ASSETS.map((asset) => (
                <button
                  key={asset.coinType}
                  className="btn btn-sm btn-outline"
                  onClick={() => onDeposit(profile.name, asset.coinType)}
                >
                  + 存入 {asset.symbol}
                </button>
              ))}
            </div>
                </>
              );
            })()}
          </div>
        ))}
      </section>
    </div>
  );
}
