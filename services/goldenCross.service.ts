export interface GoldenCrossStock {
  [key: string]: any;
}

/**
 * Fetch RAW data from Firebase Realtime Database using REST API.
 * Requires only FIREBASE_URL + FIREBASE_SECRET
 */
export async function getGoldenCrossStocks(): Promise<any> {
  const baseUrl = process.env.FIREBASE_URL;
  const secret = process.env.FIREBASE_SECRET;

  if (!baseUrl || !secret) {
    console.error("❌ Missing FIREBASE_URL or FIREBASE_SECRET in environment");
    throw new Error("Firebase credentials missing");
  }

  const url = `${baseUrl}/goldenCross.json?auth=${secret}`;

  const res = await fetch(url);

  if (!res.ok) {
    console.error("❌ Firebase fetch failed:", await res.text());
    throw new Error("Failed to fetch Firebase data");
  }

  return await res.json();
}

/**
 * Fetch specific ticker
 */
export async function getGoldenCrossStock(ticker: string): Promise<any> {
  const baseUrl = process.env.FIREBASE_URL;
  const secret = process.env.FIREBASE_SECRET;

  if (!baseUrl || !secret) {
    console.error("❌ Missing FIREBASE_URL or FIREBASE_SECRET");
    throw new Error("Firebase credentials missing");
  }

  const url = `${baseUrl}/goldenCross/${ticker}.json?auth=${secret}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  return await res.json();
}
