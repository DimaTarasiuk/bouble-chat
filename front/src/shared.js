export const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:7979" : window.location.origin)
).replace(/\/$/, "");
export const TOKEN_KEY = "chat_token";
export const USER_KEY = "chat_username";
export const ROLE_KEY = "chat_role";
export const PROFILE_HINT_KEY = "chat_profile_hint_seen";

export const isStaffRole = (role) => role === "head" || role === "admin";
export const isHeadRole = (role) => role === "head";

export const authHeaders = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROLE_KEY);
};

export const ONLINE_OFF = "#c5cad3";
export const ONLINE_OFF_TEXT = "#9ca3af";
export const onlineColor = (gender) => {
  if (gender === "male") return "#60a5fa";
  if (gender === "female") return "#f9a8d4";
  return "#86efac";
};

export const formatDateTime = (iso, fallback = "") => {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const NEU_BG = "#e0e5ec";
export const SHADOW_D = "#b8bec7";
export const SHADOW_L = "#ffffff";

export const neu = (inset = false, d = 5, b = 10) => {
  const p = inset ? "inset " : "";
  return `${p}${d}px ${d}px ${b}px ${SHADOW_D}, ${p}-${d}px -${d}px ${b}px ${SHADOW_L}`;
};

export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Vibration is optional and may be blocked by the browser.
  }
}
