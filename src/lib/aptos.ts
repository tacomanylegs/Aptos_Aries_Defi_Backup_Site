/**
 * Aptos REST API 封裝
 * 支援多節點輪換，避免單一節點限速問題
 */

import { APTOS_NODES, getNode, setNodeIndex, rotateNode } from "../config";

/**
 * 帶重試和節點輪換的 fetch
 */
async function aptosGet(path: string, retries = APTOS_NODES.length): Promise<unknown> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    const node = i === 0 ? getNode() : rotateNode();
    const url = `${node}${path}`;

    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 429) {
        // Rate limited，換節點
        lastError = new Error(`HTTP 429: Too Many Requests on ${node}`);
        console.warn(`[AptosAPI] Rate limited on ${node}, rotating...`);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return res.json();
    } catch (err) {
      lastError = err as Error;
      console.warn(`[AptosAPI] Error on ${node}:`, err);
    }
  }

  throw lastError ?? new Error("All Aptos nodes failed");
}

/**
 * POST 請求（用於 table 查詢和 view 函數）
 */
async function aptosPost(path: string, body: unknown, retries = APTOS_NODES.length): Promise<unknown> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    const node = i === 0 ? getNode() : rotateNode();
    const url = `${node}${path}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        lastError = new Error(`HTTP 429: Too Many Requests on ${node}`);
        console.warn(`[AptosAPI] Rate limited on ${node}, rotating...`);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return res.json();
    } catch (err) {
      lastError = err as Error;
      console.warn(`[AptosAPI] Error on ${node}:`, err);
    }
  }

  throw lastError ?? new Error("All Aptos nodes failed");
}

// ============================================================
// 公開 API
// ============================================================

/** 呼叫 View 函數（只讀，不需錢包） */
export async function viewFunction(
  functionId: string,
  typeArgs: string[],
  args: unknown[]
): Promise<unknown[]> {
  const result = await aptosPost("/view", {
    function: functionId,
    type_arguments: typeArgs,
    arguments: args,
  });
  return result as unknown[];
}

/** 取得帳號資源 */
export async function getAccountResource<T>(
  address: string,
  resourceType: string
): Promise<T | null> {
  try {
    const result = await aptosGet(
      `/accounts/${address}/resource/${encodeURIComponent(resourceType)}`
    );
    return (result as { data: T }).data;
  } catch {
    return null;
  }
}

/** 取得帳號所有資源 */
export async function getAccountResources(address: string): Promise<Array<{ type: string; data: unknown }>> {
  const result = await aptosGet(`/accounts/${address}/resources?limit=200`);
  return result as Array<{ type: string; data: unknown }>;
}

/**
 * 取得幣種餘額
 * 支援 Coin 和 Fungible Asset (FA) 兩種格式
 * @param address 帳號地址
 * @param coinType Coin 類型（用於舊版 Coin 查詢）
 * @param faMetadata FA Metadata 地址（用於 FA 格式查詢；可選）
 */
export async function getWalletBalance(
  address: string,
  coinType: string,
  faMetadata?: string
): Promise<number> {
  console.log(`[getWalletBalance] Fetching balance for ${address} coinType=${coinType} faMetadata=${faMetadata}`);

  // 1. 優先用 FA 查詢（primary_fungible_store::balance）
  if (faMetadata) {
    try {
      const result = await viewFunction(
        "0x1::primary_fungible_store::balance",
        ["0x1::fungible_asset::Metadata"],
        [address, faMetadata]
      );
      console.log(`[getWalletBalance] FA balance result:`, result);
      if (result && result.length > 0 && Number(result[0]) > 0) {
        return Number(result[0]);
      }
    } catch (err) {
      console.warn(`[getWalletBalance] FA balance failed for ${faMetadata}:`, err);
    }
  }

  // 2. 嘗試 0x1::coin::balance（支援已配對的 Coin/FA）
  try {
    const result = await viewFunction("0x1::coin::balance", [coinType], [address]);
    console.log(`[getWalletBalance] coin::balance result:`, result);
    if (result && result.length > 0 && Number(result[0]) > 0) {
      return Number(result[0]);
    }
  } catch (err) {
    console.warn(`[getWalletBalance] coin::balance failed for ${coinType}:`, err);
  }

  // 3. 備用：直接查詢 CoinStore 資源
  try {
    const resourceType = `0x1::coin::CoinStore<${coinType}>`;
    const resource = await getAccountResource<{ coin: { value: string } }>(address, resourceType);
    console.log(`[getWalletBalance] CoinStore resource:`, resource);
    return resource ? Number(resource.coin.value) : 0;
  } catch (err) {
    console.warn(`[getWalletBalance] CoinStore fallback failed:`, err);
    return 0;
  }
}

/** 查詢 Table Item */
export async function getTableItem<T>(
  tableHandle: string,
  keyType: string,
  valueType: string,
  key: unknown
): Promise<T> {
  const result = await aptosPost(`/tables/${tableHandle}/item`, {
    key_type: keyType,
    value_type: valueType,
    key,
  });
  return result as T;
}

/** 取得帳號資訊（包含 sequence number） */
export async function getAccountInfo(address: string): Promise<{ sequence_number: string }> {
  const result = await aptosGet(`/accounts/${address}`);
  return result as { sequence_number: string };
}

/** 取得最新區塊資訊 */
export async function getLedgerInfo(): Promise<{ chain_id: number; ledger_version: string }> {
  const result = await aptosGet("");
  return result as { chain_id: number; ledger_version: string };
}

/** 取得交易狀態 */
export async function getTransaction(txHash: string): Promise<unknown> {
  return aptosGet(`/transactions/by_hash/${txHash}`);
}

/** 等待交易確認 */
export async function waitForTransaction(txHash: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tx = await getTransaction(txHash) as { success: boolean; vm_status: string };
      if (tx.success !== undefined) {
        if (!tx.success) throw new Error(`Transaction failed: ${tx.vm_status}`);
        return;
      }
    } catch {
      // 還在 pending，繼續等
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Transaction timeout");
}
