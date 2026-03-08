const PRICE_CACHE_MS = 60_000;

let cachedAptPriceUsd: number | null = null;
let cachedAt = 0;

async function fetchFromCoinGecko(): Promise<number> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=aptos&vs_currencies=usd"
  );

  if (!response.ok) {
    throw new Error(`CoinGecko HTTP ${response.status}`);
  }

  const data = (await response.json()) as { aptos?: { usd?: number } };
  const price = data.aptos?.usd;

  if (!Number.isFinite(price) || !price || price <= 0) {
    throw new Error("CoinGecko returned invalid APT price");
  }

  return price;
}

async function fetchFromBinance(): Promise<number> {
  const response = await fetch(
    "https://api.binance.com/api/v3/ticker/price?symbol=APTUSDT"
  );

  if (!response.ok) {
    throw new Error(`Binance HTTP ${response.status}`);
  }

  const data = (await response.json()) as { price?: string };
  const price = Number(data.price);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Binance returned invalid APT price");
  }

  return price;
}

export async function getAptPriceUsd(forceRefresh = false): Promise<number> {
  const now = Date.now();
  if (!forceRefresh && cachedAptPriceUsd && now - cachedAt < PRICE_CACHE_MS) {
    return cachedAptPriceUsd;
  }

  const sources = [fetchFromCoinGecko, fetchFromBinance];
  let lastError: Error | null = null;

  for (const source of sources) {
    try {
      const price = await source();
      cachedAptPriceUsd = price;
      cachedAt = now;
      return price;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Failed to fetch APT price");
    }
  }

  throw lastError ?? new Error("Failed to fetch APT price");
}