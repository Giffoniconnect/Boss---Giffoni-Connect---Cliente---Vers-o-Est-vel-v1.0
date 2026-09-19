/**
 * Safely parse JSON from a fetch Response, handling empty bodies (HTTP 204, empty strings,
 * non-JSON content, gateway errors) without throwing "Unexpected end of JSON input".
 */
export async function safeResponseJson<T = any>(res: Response, fallback: T = {} as T): Promise<T> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch (err) {
    console.warn('[safeResponseJson] Failed to parse JSON response safely:', err);
    return fallback;
  }
}

/**
 * Safely parse a JSON string, returning fallback on error or empty string
 */
export function safeJsonParse<T = any>(str: string | null | undefined, fallback: T = {} as T): T {
  if (!str || !str.trim()) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
