/**
 * Aries Markets 智能合約互動函式庫
 *
 * 合約地址: 0x9770fa9c725cbd97eb50b2be5f7416efdfd1f1554beb0750d4dae4c64e860da3
 * 從鏈上真實交易分析所得的正確函數簽名和資料結構
 *
 * 關鍵資料結構（已驗證）：
 * - IterableTable value type: {CONTROLLER}::iterable_table::IterableValue<TypeInfo, Deposit>
 * - Deposit.collateral_amount: u64 (LP share 數量)
 * - ReserveDetails: 透過 Reserves.stats table 查詢
 * - 匯率: (total_cash + total_borrowed.val/1e18 - reserve_amount.val/1e18) / total_lp_supply
 */

import {
  CONTROLLER,
  FUNCTIONS,
  VIEW_FUNCTIONS,
  RESOURCE_TYPES,
  MAX_U64,
  APT_COIN_TYPE,
  AssetConfig,
} from "../config";
import {
  viewFunction,
  getAccountResource,
  getTableItem,
} from "./aptos";

// ============================================================
// 類型定義
// ============================================================

export interface ProfilesData {
  profile_signers: {
    data: Array<{
      key: string; // "profile{profileName}"
      value: { account: string };
    }>;
  };
  referrer: { vec: string[] };
}

export interface ProfileData {
  deposited_reserves: {
    head: { vec: TypeInfoRaw[] };
    inner: {
      inner: { handle: string };
      length: string;
    };
    tail: { vec: TypeInfoRaw[] };
  };
  borrowed_reserves: {
    head: { vec: TypeInfoRaw[] };
    inner: {
      inner: { handle: string };
      length: string;
    };
    tail: { vec: TypeInfoRaw[] };
  };
}

/** Move TypeInfo 的原始格式 */
interface TypeInfoRaw {
  account_address: string;
  module_name: string; // hex encoded
  struct_name: string; // hex encoded
}

/** 存款資料（已修正欄位名稱） */
export interface DepositInfo {
  coinType: string;
  symbol: string;
  /** LP share 數量（collateral_amount from Deposit struct） */
  collateral_amount: string;
  /** 計算後的實際代幣金額 */
  amount?: number;
}

/**
 * 真實的 ReserveDetails 結構（從 Reserves.stats table 查詢）
 *
 * Decimal 類型: { val: string }，實際值 = val / 1e18
 */
export interface ReserveDetails {
  total_lp_supply: string;             // u128，LP token 總供應量
  total_cash_available: string;        // u128，vault 中的現金
  initial_exchange_rate: { val: string }; // Decimal，初始匯率（1e18）
  reserve_amount: { val: string };        // Decimal，儲備金
  total_borrowed_share: { val: string };  // Decimal，借款份額
  total_borrowed: { val: string };        // Decimal，實際借款金額
  interest_accrue_timestamp: string;
  reserve_config: ReserveConfig;
  interest_rate_config: AriresInterestRateConfig;
}

export interface ReserveConfig {
  allow_collateral: boolean;
  allow_redeem: boolean;
  borrow_factor: number;
  borrow_fee_hundredth_bips: string;
  borrow_limit: string;
  deposit_limit: string;
  liquidation_bonus_bips: string;
  liquidation_threshold: number;
  loan_to_value: number;
  reserve_ratio: number;  // 0-100 整數，例如 35 = 35%
  withdraw_fee_hundredth_bips: string;
}

/** Aries 自訂的利率設定（值為整數百分比） */
export interface AriresInterestRateConfig {
  min_borrow_rate: string;    // 最低借款年利率（%）
  optimal_borrow_rate: string; // 最優使用率時的借款年利率（%）
  max_borrow_rate: string;     // 最高借款年利率（%）
  optimal_utilization: string; // 最優使用率（0-100整數）
}

export interface UserDeposit {
  profileName: string;
  profileAddress: string;
  deposits: DepositInfo[];
}

export interface ClaimableReward {
  coinType: string;
  symbol: string;
  amountRaw: string;
  amount: number;
  decimals: number;
}

/** Reserves 資源（存放 stats table handle） */
interface ReservesResource {
  stats: { handle: string };
  farms: { handle: string };
}

// ============================================================
// Profile 查詢
// ============================================================

/**
 * 取得用戶所有 Profile 及其對應的 resource account 地址
 */
export async function getUserProfiles(
  userAddress: string
): Promise<{ name: string; address: string }[]> {
  const data = await getAccountResource<ProfilesData>(
    userAddress,
    RESOURCE_TYPES.PROFILES
  );

  if (!data) return [];

  return data.profile_signers.data.map((item) => ({
    // key 格式為 "profile{profileName}"
    name: item.key.startsWith("profile") ? item.key.slice("profile".length) : item.key,
    address: item.value.account,
  }));
}

/**
 * 透過 View 函數取得 Profile 的 resource account 地址
 */
export async function getProfileAddress(
  userAddress: string,
  profileName: string
): Promise<string | null> {
  try {
    const result = await viewFunction(
      VIEW_FUNCTIONS.GET_PROFILE_ADDRESS,
      [],
      [userAddress, profileName]
    );
    return result[0] as string;
  } catch {
    return null;
  }
}

// ============================================================
// 存款餘額查詢（已修正 IterableValue 類型和欄位名稱）
// ============================================================

/** ASCII 字串編碼為 hex（瀏覽器相容） */
function stringToHex(str: string): string {
  return Array.from(str)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
}

/** 解碼 hex 字串為 ASCII */
function hexToString(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  let result = "";
  for (let i = 0; i < clean.length; i += 2) {
    result += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  return result;
}

/** TypeInfo raw -> coinType 字串 */
function typeInfoToCoinType(ti: TypeInfoRaw): string {
  const module = hexToString(ti.module_name);
  const struct_ = hexToString(ti.struct_name);
  return `${ti.account_address}::${module}::${struct_}`;
}

/**
 * Aries IterableTable 的實際 value 包裝類型
 *
 * 結構:
 * IterableValue<K, V> {
 *   val: V,
 *   prev: Option<K>,
 *   next: Option<K>
 * }
 * 模組: {CONTROLLER}::iterable_table（非 0x1::iterable_table）
 */
function iterableValueType(valueType: string): string {
  return `${CONTROLLER}::iterable_table::IterableValue<0x1::type_info::TypeInfo, ${valueType}>`;
}

/**
 * 取得 Profile 的存款資料
 *
 * 使用正確的 IterableValue 包裝類型和 collateral_amount 欄位
 */
export async function getProfileDeposits(
  profileAddress: string
): Promise<DepositInfo[]> {
  const profile = await getAccountResource<ProfileData>(
    profileAddress,
    RESOURCE_TYPES.PROFILE
  );

  if (!profile) return [];

  const tableHandle = profile.deposited_reserves.inner.inner.handle;
  const length = parseInt(profile.deposited_reserves.inner.length);

  if (length === 0) return [];

  // 從 head 和 tail 收集 coin types（IterableTable 的首尾指標）
  const coinTypes: TypeInfoRaw[] = [
    ...profile.deposited_reserves.head.vec,
    ...profile.deposited_reserves.tail.vec,
  ];

  // 如果 length > 2，還有中間節點需要透過 linked list 遍歷
  // 但通常大多數用戶的存款幣種不超過 2-3 個，head+tail 已足夠
  // TODO: 如需完整遍歷，可從 head 開始沿 next 指標走

  const deposits: DepositInfo[] = [];
  const seenCoinTypes = new Set<string>();

  for (const ti of coinTypes) {
    const coinType = typeInfoToCoinType(ti);
    if (seenCoinTypes.has(coinType)) continue;
    seenCoinTypes.add(coinType);

    try {
      // 正確的 value_type: Aries 自訂 IterableValue 包裝類型
      const wrappedValue = await getTableItem<{
        val: { collateral_amount: string };
        prev: { vec: TypeInfoRaw[] };
        next: { vec: TypeInfoRaw[] };
      }>(
        tableHandle,
        "0x1::type_info::TypeInfo",
        iterableValueType(`${CONTROLLER}::profile::Deposit`),
        {
          account_address: ti.account_address,
          module_name: ti.module_name,
          struct_name: ti.struct_name,
        }
      );

      deposits.push({
        coinType,
        symbol: getCoinSymbol(coinType),
        collateral_amount: wrappedValue.val.collateral_amount,
      });
    } catch (err) {
      console.warn(`Failed to fetch deposit for ${coinType}:`, err);
    }
  }

  // 如果有更多中間節點（length > deposited head+tail 數），沿 linked list 遍歷
  // 從 head 的 next 開始，直到 tail
  if (length > coinTypes.length && coinTypes.length > 0) {
    let nextTi = coinTypes[0];
    const maxIter = length;
    let iter = 0;

    while (iter < maxIter) {
      try {
        const wrappedValue = await getTableItem<{
          val: { collateral_amount: string };
          prev: { vec: TypeInfoRaw[] };
          next: { vec: TypeInfoRaw[] };
        }>(
          tableHandle,
          "0x1::type_info::TypeInfo",
          iterableValueType(`${CONTROLLER}::profile::Deposit`),
          {
            account_address: nextTi.account_address,
            module_name: nextTi.module_name,
            struct_name: nextTi.struct_name,
          }
        );

        const coinType = typeInfoToCoinType(nextTi);
        if (!seenCoinTypes.has(coinType)) {
          seenCoinTypes.add(coinType);
          deposits.push({
            coinType,
            symbol: getCoinSymbol(coinType),
            collateral_amount: wrappedValue.val.collateral_amount,
          });
        }

        if (wrappedValue.next.vec.length === 0) break;
        nextTi = wrappedValue.next.vec[0];
        iter++;
      } catch {
        break;
      }
    }
  }

  return deposits;
}

/** 根據 coinType 取得幣種符號 */
function getCoinSymbol(coinType: string): string {
  if (coinType.includes("AptosCoin")) return "APT";
  if (coinType.includes("WrappedUSDT")) return "USDT";
  if (coinType.includes("WrappedUSDC")) return "USDC";
  if (coinType.includes("StakedApt") || coinType.includes("stapt")) return "stAPT";
  if (coinType.includes("AmnisApt") || coinType.includes("amapt")) return "amAPT";
  if (coinType.includes("USDT")) return "USDT";
  if (coinType.includes("USDC")) return "USDC";
  const parts = coinType.split("::");
  return parts[parts.length - 1];
}

function getCoinDecimals(coinType: string): number {
  if (coinType === APT_COIN_TYPE || coinType.includes("AptosCoin")) return 8;
  if (coinType.includes("StakedApt") || coinType.includes("stapt")) return 8;
  return 6;
}

export async function getProfileClaimableRewards(
  userAddress: string,
  profileName: string
): Promise<ClaimableReward[]> {
  try {
    const result = await viewFunction(
      VIEW_FUNCTIONS.CLAIMABLE_REWARDS,
      [],
      [userAddress, profileName]
    );

    const rewardTypes = (result[0] as TypeInfoRaw[] | undefined) ?? [];
    const rewardAmounts = (result[1] as string[] | undefined) ?? [];

    return rewardTypes
      .map((typeInfo, index) => {
        const coinType = typeInfoToCoinType(typeInfo);
        const decimals = getCoinDecimals(coinType);
        const amountRaw = rewardAmounts[index] ?? "0";

        return {
          coinType,
          symbol: getCoinSymbol(coinType),
          amountRaw,
          amount: Number(amountRaw) / 10 ** decimals,
          decimals,
        };
      })
      .filter((reward) => BigInt(reward.amountRaw) > 0n)
      .sort((left, right) => Number(BigInt(right.amountRaw) - BigInt(left.amountRaw)));
  } catch (err) {
    console.warn(`Failed to get claimable rewards for ${profileName}:`, err);
    return [];
  }
}

// ============================================================
// Reserve 資料查詢（透過 Reserves.stats table）
// ============================================================

let reservesStatsHandle: string | null = null;

/**
 * 取得 Reserves.stats table handle（快取，只查一次）
 */
async function getReservesStatsHandle(): Promise<string> {
  if (reservesStatsHandle) return reservesStatsHandle;

  const reserves = await getAccountResource<ReservesResource>(
    CONTROLLER,
    `${CONTROLLER}::reserve::Reserves`
  );

  if (!reserves) throw new Error("無法取得 Reserves 資源");
  reservesStatsHandle = reserves.stats.handle;
  return reservesStatsHandle;
}

/**
 * 取得指定幣種的 ReserveDetails
 *
 * 資料存在 Reserves.stats 這個 Table<TypeInfo, ReserveDetails> 中
 */
export async function getReserveDetails(
  coinType: string
): Promise<ReserveDetails | null> {
  try {
    const handle = await getReservesStatsHandle();

    // 解析 coinType 為 TypeInfo
    const parts = coinType.split("::");
    if (parts.length < 3) return null;

    const accountAddress = parts[0];
    const moduleName = parts[1];
    const structName = parts.slice(2).join("::"); // 處理泛型類型

    // 將 module name 和 struct name 編碼為 hex（瀏覽器相容）
    const moduleNameHex = "0x" + stringToHex(moduleName);
    const structNameHex = "0x" + stringToHex(structName);

    const result = await getTableItem<ReserveDetails>(
      handle,
      "0x1::type_info::TypeInfo",
      `${CONTROLLER}::reserve_details::ReserveDetails`,
      {
        account_address: accountAddress,
        module_name: moduleNameHex,
        struct_name: structNameHex,
      }
    );

    return result;
  } catch (err) {
    console.warn(`Failed to get ReserveDetails for ${coinType}:`, err);
    return null;
  }
}

// ============================================================
// 金額計算（已修正公式）
// ============================================================

const DECIMAL_SCALE = 1_000_000_000_000_000_000n; // 1e18（Aries Decimal 的 scale）

function getDecimalTokenAmount(value: { val: string }): bigint {
  return BigInt(value.val) / DECIMAL_SCALE;
}

function getMarketSizeRaw(reserve: ReserveDetails): bigint {
  const totalCash = BigInt(reserve.total_cash_available);
  const totalBorrowed = getDecimalTokenAmount(reserve.total_borrowed);
  const reserveAmount = getDecimalTokenAmount(reserve.reserve_amount);

  return totalCash + totalBorrowed - reserveAmount;
}

function calculateBorrowAPR(reserve: ReserveDetails, utilization: number): number {
  const irc = reserve.interest_rate_config;
  const optimalUtil = Number(irc.optimal_utilization) / 100;
  const minBorrowRate = Number(irc.min_borrow_rate);
  const optimalBorrowRate = Number(irc.optimal_borrow_rate);
  const maxBorrowRate = Number(irc.max_borrow_rate);

  if (utilization <= optimalUtil) {
    if (optimalUtil === 0) {
      return minBorrowRate;
    }

    return minBorrowRate + (utilization / optimalUtil) * (optimalBorrowRate - minBorrowRate);
  }

  const excess = (utilization - optimalUtil) / (1 - optimalUtil);
  return optimalBorrowRate + excess * (maxBorrowRate - optimalBorrowRate);
}

/**
 * 計算存款實際金額
 *
 * 公式: amount = collateral_amount × (total_cash + total_borrowed - reserve_amount) / total_lp_supply
 *
 * 注意: total_borrowed / reserve_amount 都是 Decimal 類型，需除以 1e18
 */
export function calculateDepositAmount(
  collateralAmount: bigint,
  reserve: ReserveDetails,
  decimals: number
): number {
  const totalLP = BigInt(reserve.total_lp_supply);
  if (totalLP === 0n) return 0;

  const marketSize = getMarketSizeRaw(reserve);
  if (marketSize <= 0n) return 0;

  const rawAmount = (collateralAmount * marketSize) / totalLP;

  return Number(rawAmount) / 10 ** decimals;
}

/**
 * 計算存款年化利率（Supply APR）
 *
 * Aries 利率模型（與 Aave 類似）：
 * - 利率以整數百分比儲存（例如 9 = 9%）
 * - 使用率 < optimal：借款率在 min 和 optimal 之間線性插值
 * - 使用率 >= optimal：借款率在 optimal 和 max 之間線性插值
 * - 供款率 = 借款率 × 使用率 × (1 - 儲備比例)
 */
export function calculateSupplyAPR(reserve: ReserveDetails): number {
  const rc = reserve.reserve_config;

  const totalBorrowed = getDecimalTokenAmount(reserve.total_borrowed);
  const marketSize = getMarketSizeRaw(reserve);

  if (marketSize <= 0n) return 0;

  // 使用率（0-1）
  const utilization = Number(totalBorrowed) / Number(marketSize);
  const borrowAPR = calculateBorrowAPR(reserve, utilization);

  // 供款利率 = 借款利率 × 使用率 × (1 - 儲備比例)
  const reserveRatio = rc.reserve_ratio / 100; // 35 → 0.35
  const supplyAPR = borrowAPR * utilization * (1 - reserveRatio);

  return supplyAPR;
}

// ============================================================
// 取得完整帳戶資訊
// ============================================================

export interface AccountSummary {
  profiles: {
    name: string;
    address: string;
    deposits: (DepositInfo & {
      amount: number;
      supplyAPR: number;
    })[];
    claimableRewards: ClaimableReward[];
  }[];
}

/**
 * 取得用戶在 Aries 的完整存款狀況
 */
export async function getAccountSummary(
  userAddress: string,
  assetConfigs: AssetConfig[]
): Promise<AccountSummary> {
  const profiles = await getUserProfiles(userAddress);
  const result: AccountSummary = { profiles: [] };

  for (const profile of profiles) {
    const [rawDeposits, claimableRewards] = await Promise.all([
      getProfileDeposits(profile.address),
      getProfileClaimableRewards(userAddress, profile.name),
    ]);

    const enrichedDeposits = await Promise.all(
      rawDeposits.map(async (dep) => {
        const asset = assetConfigs.find((a) => a.coinType === dep.coinType);
        const decimals = asset?.decimals ?? 6;

        const reserve = await getReserveDetails(dep.coinType);
        const collateralAmount = BigInt(dep.collateral_amount);
        const amount = reserve ? calculateDepositAmount(collateralAmount, reserve, decimals) : 0;
        const supplyAPR = reserve ? calculateSupplyAPR(reserve) : 0;

        return {
          ...dep,
          amount,
          supplyAPR,
        };
      })
    );

    result.profiles.push({
      ...profile,
      deposits: enrichedDeposits,
      claimableRewards,
    });
  }

  return result;
}

// ============================================================
// Reserve 市場概覽
// ============================================================

export interface ReserveSummary {
  coinType: string;
  symbol: string;
  totalDeposited: number;
  totalBorrowed: number;
  utilizationRate: number;
  supplyAPR: number;
  borrowAPR: number;
  decimals: number;
}

export async function getAllReserveSummaries(
  assets: AssetConfig[]
): Promise<ReserveSummary[]> {
  const results: ReserveSummary[] = [];

  for (const asset of assets) {
    try {
      const reserve = await getReserveDetails(asset.coinType);
      if (!reserve) continue;

      const totalBorrowed = getDecimalTokenAmount(reserve.total_borrowed);
      const marketSize = getMarketSizeRaw(reserve);

      const totalDepositedNum = Number(marketSize) / 10 ** asset.decimals;
      const totalBorrowedNum = Number(totalBorrowed) / 10 ** asset.decimals;
      const utilizationRate = totalDepositedNum > 0 ? totalBorrowedNum / totalDepositedNum : 0;

      const supplyAPR = calculateSupplyAPR(reserve);
      const borrowAPR = calculateBorrowAPR(reserve, utilizationRate);

      results.push({
        coinType: asset.coinType,
        symbol: asset.symbol,
        totalDeposited: totalDepositedNum,
        totalBorrowed: totalBorrowedNum,
        utilizationRate,
        supplyAPR,
        borrowAPR,
        decimals: asset.decimals,
      });
    } catch (err) {
      console.warn(`Failed to get reserve for ${asset.symbol}:`, err);
    }
  }

  return results;
}

// ============================================================
// 交易建構
// ============================================================

export interface TxPayload {
  type: "entry_function_payload";
  function: string;
  type_arguments: string[];
  arguments: (string | boolean | number)[];
}

/**
 * 建構存款交易 payload
 */
export function buildDepositPayload(
  profileName: string,
  coinType: string,
  amount: bigint
): TxPayload {
  return {
    type: "entry_function_payload",
    function: FUNCTIONS.DEPOSIT_FA,
    type_arguments: [coinType],
    arguments: [profileName, amount.toString()],
  };
}

/**
 * 建構取款交易 payload
 * @param amount 數量，傳 null 表示取出全部（MAX_U64）
 */
export function buildWithdrawPayload(
  profileName: string,
  coinType: string,
  amount: bigint | null,
  allowBorrow = false
): TxPayload {
  return {
    type: "entry_function_payload",
    function: FUNCTIONS.WITHDRAW_FA,
    type_arguments: [coinType],
    arguments: [profileName, amount?.toString() ?? MAX_U64, allowBorrow],
  };
}

export function buildClaimRewardsPayload(
  profileName: string,
  rewardCoinType = APT_COIN_TYPE
): TxPayload {
  return {
    type: "entry_function_payload",
    function: FUNCTIONS.CLAIM_REWARDS,
    type_arguments: [rewardCoinType],
    arguments: [profileName],
  };
}

/**
 * 建構初始化 Profile 交易
 */
export function buildInitProfilePayload(): TxPayload {
  return {
    type: "entry_function_payload",
    function: FUNCTIONS.INIT_PROFILE,
    type_arguments: [],
    arguments: [],
  };
}
