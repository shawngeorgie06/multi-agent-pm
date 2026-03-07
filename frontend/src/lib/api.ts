/**
 * API and WebSocket base URLs. Set VITE_API_URL in .env (e.g. http://localhost:3002).
 * WS URL defaults to the same host as API.
 */
const getApiUrl = (): string => {
  const url = import.meta.env.VITE_API_URL;
  if (url && typeof url === "string") return url.replace(/\/$/, "");
  return "http://localhost:5555";
};

const getWsUrl = (): string => {
  const ws = import.meta.env.VITE_WS_URL;
  if (ws && typeof ws === "string") return ws.replace(/\/$/, "");
  return getApiUrl();
};

export const API_URL = getApiUrl();
export const WS_URL = getWsUrl();
