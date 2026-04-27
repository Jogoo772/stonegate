import { useQuery } from "@tanstack/react-query";

export type LivePrice = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  lastUpdated: number;
};

export const TRACKED_COINS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "tether", symbol: "USDT", name: "Tether" },
  { id: "ripple", symbol: "XRP", name: "Ripple" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
] as const;

type CoinGeckoResponse = Record<
  string,
  { usd: number; usd_24h_change: number; last_updated_at: number }
>;

async function fetchPrices(): Promise<Record<string, LivePrice>> {
  const ids = TRACKED_COINS.map((c) => c.id).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = (await res.json()) as CoinGeckoResponse;
  const out: Record<string, LivePrice> = {};
  for (const coin of TRACKED_COINS) {
    const row = data[coin.id];
    if (!row) continue;
    out[coin.symbol] = {
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      price: row.usd,
      change24h: row.usd_24h_change ?? 0,
      lastUpdated: (row.last_updated_at ?? Date.now() / 1000) * 1000,
    };
  }
  return out;
}

export function useLivePrices() {
  return useQuery({
    queryKey: ["live-prices"],
    queryFn: fetchPrices,
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
    staleTime: 8_000,
    retry: 2,
  });
}
