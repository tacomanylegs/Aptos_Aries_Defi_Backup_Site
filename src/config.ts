// ============================================================
// Aries Markets 合約設定
// 從實際鏈上交易分析取得的正確地址和函數
// ============================================================

/** Aries Markets Controller 合約地址 */
export const CONTROLLER = "0x9770fa9c725cbd97eb50b2be5f7416efdfd1f1554beb0750d4dae4c64e860da3";

/** Aptos 主網節點（可更換為其他節點避免限速）*/
export const APTOS_NODES = [
  "https://fullnode.mainnet.aptoslabs.com/v1",
  "https://aptos-mainnet.nodereal.io/v1/f026e0da1c574f7ca1bd4cc0e53a6453/v1",
  "https://rpc.ankr.com/http/aptos/v1",
  "https://aptos-mainnet-rpc.publicnode.com/v1",
];

/** 預設使用第一個節點，失敗時自動切換 */
export let currentNodeIndex = 0;
export const getNode = () => APTOS_NODES[currentNodeIndex];
export const rotateNode = () => {
  currentNodeIndex = (currentNodeIndex + 1) % APTOS_NODES.length;
  return getNode();
};

// ============================================================
// 幣種類型
// ============================================================

/** Aries 包裝的 USDT（Fungible Asset wrapper） */
export const USDT_COIN_TYPE = `${CONTROLLER}::fa_to_coin_wrapper::WrappedUSDT`;

/** Aries 包裝的 USDC */
export const USDC_COIN_TYPE = `${CONTROLLER}::wrapped_coins::WrappedUSDC`;

/** LayerZero 原生 USDT */
export const LZ_USDT_COIN_TYPE =
  "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT";

/** LayerZero 原生 USDC */
export const LZ_USDC_COIN_TYPE =
  "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC";

/** Aptos Coin（Aries 獎勵） */
export const APT_COIN_TYPE = "0x1::aptos_coin::AptosCoin";

// ============================================================
// 支援的存款幣種設定
// ============================================================
export interface AssetConfig {
  name: string;
  symbol: string;
  decimals: number;
  coinType: string;
  icon: string;
}

/** Amnis Staked APT */
export const STAPT_COIN_TYPE =
  "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt";

export const SUPPORTED_ASSETS: AssetConfig[] = [
  {
    name: "Tether USD",
    symbol: "USDT",
    decimals: 6,
    coinType: USDT_COIN_TYPE,
    icon: "💵",
  },
  {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    coinType: USDC_COIN_TYPE,
    icon: "💲",
  },
  {
    name: "Amnis Staked APT",
    symbol: "stAPT",
    decimals: 8,
    coinType: STAPT_COIN_TYPE,
    icon: "🔵",
  },
];

// ============================================================
// Profile 設定（從鏈上交易分析）
// 每個 Profile 是一個獨立的借貸帳戶
// ============================================================
export const DEFAULT_PROFILES = [
  "Main Account",
  "vibrantx::aries_lending",
];

// ============================================================
// 合約函數名稱
// ============================================================
export const FUNCTIONS = {
  /** 存入 Fungible Asset */
  DEPOSIT_FA: `${CONTROLLER}::controller::deposit_fa`,
  /** 取款 Fungible Asset */
  WITHDRAW_FA: `${CONTROLLER}::controller::withdraw_fa`,
  /** 領取獎勵 */
  CLAIM_REWARDS: `${CONTROLLER}::wrapped_controller::claim_rewards`,
  /** 存入 Coin */
  DEPOSIT: `${CONTROLLER}::controller::deposit`,
  /** 取款 Coin */
  WITHDRAW: `${CONTROLLER}::controller::withdraw`,
  /** 初始化 Profile（首次使用需要呼叫） */
  INIT_PROFILE: `${CONTROLLER}::profile::init`,
} as const;

// ============================================================
// View 函數（只讀查詢，不需要錢包）
// ============================================================
export const VIEW_FUNCTIONS = {
  GET_PROFILE_ADDRESS: `${CONTROLLER}::profile::get_profile_address`,
  CLAIMABLE_REWARDS: `${CONTROLLER}::profile::claimable_reward_amounts`,
} as const;

// ============================================================
// 資源類型
// ============================================================
export const RESOURCE_TYPES = {
  PROFILES: `${CONTROLLER}::profile::Profiles`,
  PROFILE: `${CONTROLLER}::profile::Profile`,
} as const;

/** u64 最大值 = 取出全部 */
export const MAX_U64 = "18446744073709551615";

/** Aptos Explorer 網址 */
export const EXPLORER_URL = "https://explorer.aptoslabs.com";
