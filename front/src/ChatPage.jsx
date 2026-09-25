import { useState, useRef, useEffect, useLayoutEffect } from "react";
import notificationMp3 from "./static/bulk-10.mp3";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:7979" : window.location.origin)
).replace(/\/$/, "");
const TOKEN_KEY = "chat_token";
const USER_KEY = "chat_username";
const ROLE_KEY = "chat_role";
const PROFILE_HINT_KEY = "chat_profile_hint_seen";

const isStaffRole = (role) => role === "head" || role === "admin";
const isHeadRole = (role) => role === "head";

const authHeaders = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROLE_KEY);
};

const ONLINE_OFF = "#c5cad3";
const ONLINE_OFF_TEXT = "#9ca3af";
const onlineColor = (gender) => {
  if (gender === "male") return "#60a5fa";
  if (gender === "female") return "#f9a8d4";
  return "#86efac";
};

const createNotificationSound = () => {
  const audio = new Audio(notificationMp3);
  audio.preload = "auto";
  audio.playsInline = true;
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  return audio;
};

const playNotification = (audioRef) => {
  const audio = audioRef.current;
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  } catch {
    // Ignore autoplay / media errors on mobile.
  }
};

const NEU_BG = "#e0e5ec";
const SHADOW_D = "#b8bec7";
const SHADOW_L = "#ffffff";

const neu = (inset = false, d = 5, b = 10) => {
  const p = inset ? "inset " : "";
  return `${p}${d}px ${d}px ${b}px ${SHADOW_D}, ${p}-${d}px -${d}px ${b}px ${SHADOW_L}`;
};

function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Vibration is optional and may be blocked by the browser.
  }
}

function AppStyles() {
  useEffect(() => {
    const onDown = (e) => {
      const el = e.target.closest?.(".neu-press, .neu-press-send, .neu-press-soft");
      if (!el) return;
      haptic(el.classList.contains("neu-press-send") ? 20 : 12);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: ${NEU_BG}; }
      ::-webkit-scrollbar { width: 0; }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes profileHintPulse {
        0%, 100% {
          transform: scale(1);
          box-shadow: 4px 4px 8px ${SHADOW_D}, -4px -4px 8px ${SHADOW_L};
        }
        40% {
          transform: scale(1.1);
          box-shadow: 0 0 0 0 rgba(192, 132, 160, 0.45), 4px 4px 8px ${SHADOW_D}, -4px -4px 8px ${SHADOW_L};
        }
        70% {
          transform: scale(1.04);
          box-shadow: 0 0 0 10px rgba(192, 132, 160, 0), 4px 4px 8px ${SHADOW_D}, -4px -4px 8px ${SHADOW_L};
        }
      }
      .profile-hint-pulse {
        animation: profileHintPulse 1.35s ease-in-out infinite;
      }
      .neu-press {
        transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .neu-press:active {
        transform: scale(0.97);
        box-shadow: inset 3px 3px 6px ${SHADOW_D}, inset -3px -3px 6px ${SHADOW_L} !important;
      }
      .neu-press-send:active {
        transform: scale(0.93);
        box-shadow: inset 3px 3px 6px #6e7580, inset -3px -3px 6px #9ea8b3 !important;
      }
      .neu-press-soft:active {
        transform: scale(0.96);
        opacity: 0.65;
      }
    `}</style>
  );
}

function Avatar({ initials, color }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: NEU_BG,
      boxShadow: neu(false, 3, 6),
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      fontSize: 12, fontWeight: 800, color,
      letterSpacing: "0.02em",
    }}>
      {initials}
    </div>
  );
}

const EDIT_WINDOW_MS = 10 * 60 * 1000;

function canEditMessage(msg, username) {
  if (!msg || msg.from !== username) return false;
  if (typeof msg.id !== "number") return false;
  const created = new Date(msg.time).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= EDIT_WINDOW_MS;
}

function Bubble({ msg, username, animate = false, onEdit, onReply }) {
  const isMe = msg.from === username;
  const canReply = !isMe && typeof onReply === "function";
  const initials = (msg.from || "?").slice(0, 2).toUpperCase();
  const longPressRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0, dragging: false, replied: false, pointerId: null, active: false });
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragXRef = useRef(0);

  const clearLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const resetDrag = () => {
    startRef.current.dragging = false;
    startRef.current.replied = false;
    startRef.current.active = false;
    startRef.current.pointerId = null;
    dragXRef.current = 0;
    setDragX(0);
    setDragging(false);
  };

  const snapBack = () => {
    startRef.current.dragging = false;
    dragXRef.current = 0;
    setDragX(0);
    setDragging(false);
  };

  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    // Own messages: capture for long-press edit only. Reply capture starts on confirmed drag.
    if (isMe) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      dragging: false,
      replied: false,
      pointerId: e.pointerId,
      active: true,
    };
    dragXRef.current = 0;
    setDragX(0);
    setDragging(false);
    clearLongPress();
    if (isMe && onEdit && canEditMessage(msg, username)) {
      longPressRef.current = setTimeout(() => {
        longPressRef.current = null;
        if (startRef.current.dragging || startRef.current.replied) return;
        haptic(18);
        onEdit(msg);
      }, 480);
    }
  };

  const onPointerMove = (e) => {
    const start = startRef.current;
    if (!start.active || start.replied || !canReply) return;
    // Ignore hover / move without primary button (mouse false triggers)
    if (e.pointerType === "mouse" && (e.buttons & 1) !== 1) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!start.dragging) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        clearLongPress();
      }
      // only start reply-drag when clearly horizontal right swipe
      if (dx > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        start.dragging = true;
        setDragging(true);
        clearLongPress();
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // ignore
        }
      } else {
        return;
      }
    }

    e.preventDefault?.();
    const next = Math.max(0, Math.min(72, dx));
    dragXRef.current = next;
    setDragX(next);
    if (next >= 56 && start.dragging) {
      start.replied = true;
      haptic(16);
      snapBack();
      onReply(msg);
    }
  };

  const onPointerUp = (e) => {
    clearLongPress();
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    resetDrag();
  };

  const onPointerCancel = () => {
    clearLongPress();
    resetDrag();
  };

  const onLostPointerCapture = () => {
    clearLongPress();
    resetDrag();
  };

  const onContextMenu = (e) => {
    if (isMe && canEditMessage(msg, username)) e.preventDefault();
  };

  const replyPreview = msg.reply_to;

  return (
    <div style={{
      display: "flex",
      flexDirection: isMe ? "row-reverse" : "row",
      alignItems: "flex-end",
      gap: 10,
      marginBottom: 16,
      position: "relative",
      ...(animate ? { animation: "fadeUp 0.25s ease both" } : {}),
    }}>
      {!isMe && <Avatar initials={initials} color="#c084a0" />}

      <div
        style={{
        maxWidth: "68%",
        display: "flex",
        flexDirection: "column",
        alignItems: isMe ? "flex-end" : "flex-start",
        transform: canReply ? `translateX(${dragX}px)` : undefined,
        transition: canReply && !dragging ? "transform 0.18s ease" : "none",
        willChange: canReply ? "transform" : undefined,
      }}>
        {!isMe && (
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, marginBottom: 3, paddingLeft: 4 }}>
            {msg.from}
          </span>
        )}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={canReply || isMe ? onPointerMove : undefined}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onLostPointerCapture}
          onContextMenu={onContextMenu}
          style={{
            padding: "11px 16px",
            borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            background: isMe ? "#ffffff" : "#f5e8ee",
            boxShadow: isMe
              ? `4px 4px 10px ${SHADOW_D}, -4px -4px 10px ${SHADOW_L}`
              : `4px 4px 10px #d9b8c8, -4px -4px 10px ${SHADOW_L}`,
            fontSize: 14,
            fontWeight: 600,
            color: "#4b5563",
            lineHeight: 1.5,
            fontFamily: "'Nunito', sans-serif",
            touchAction: canReply ? "pan-y" : "auto",
            userSelect: "none",
            WebkitUserSelect: "none",
            cursor: isMe && canEditMessage(msg, username) ? "pointer" : (canReply ? "grab" : "default"),
            maxWidth: "100%",
          }}
        >
          {replyPreview && (
            <div style={{
              marginBottom: 8,
              padding: "6px 10px",
              borderRadius: 10,
              borderLeft: "3px solid #c084a0",
              background: isMe ? "rgba(192,132,160,0.12)" : "rgba(255,255,255,0.55)",
              fontSize: 12,
              lineHeight: 1.35,
            }}>
              <div style={{ fontWeight: 800, color: "#c084a0", marginBottom: 2 }}>
                {replyPreview.from}
              </div>
              <div style={{
                fontWeight: 600,
                color: "#6b7280",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 180,
              }}>
                {replyPreview.text}
              </div>
            </div>
          )}
          {msg.text}
        </div>
        <span style={{
          fontSize: 11, color: "#9ca3af", fontWeight: 600,
          marginTop: 4, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0,
        }}>
          {new Date(msg.time).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {isMe && <Avatar initials={initials} color="#6b8fb5" />}
    </div>
  );
}

function NeuField({ type = "text", value, onChange, placeholder, onKey, autoFocus }) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div style={{
      width: "100%",
      display: "flex", alignItems: "center",
      background: NEU_BG,
      borderRadius: 50,
      boxShadow: neu(true, 4, 8),
      padding: isPassword ? "0 12px 0 20px" : "0 20px",
    }}>
      <input
        type={isPassword && visible ? "text" : type}
        value={value}
        onChange={onChange}
        onKeyDown={onKey}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={isPassword ? "current-password" : undefined}
        style={{
          flex: 1,
          border: "none", outline: "none",
          background: "transparent",
          fontFamily: "'Nunito', sans-serif",
          fontSize: 14, fontWeight: 600,
          color: "#4b5563",
          padding: "14px 0",
          minWidth: 0,
        }}
      />
      {isPassword && (
        <button
          type="button"
          className="neu-press-soft"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? "Сховати пароль" : "Показати пароль"}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: "6px 8px",
            color: "#9ca3af",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {visible ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

const GENDER_OPTIONS = [
  { value: "male", label: "Чол" },
  { value: "female", label: "Жін" },
];

function isoToBirthDisplay(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function birthDisplayToIso(display) {
  const raw = String(display || "").trim();
  if (!raw) return "";
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (year < 1900 || year > 2100) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatBirthInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function ProfileCard({ onClose, onSaved }) {
  const [login, setLogin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [avatarTip, setAvatarTip] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/me`, { headers: authHeaders() })
      .then(async (res) => {
        if (res.status === 401) {
          clearSession();
          onClose({ logout: true });
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data?.user) return;
        if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
        const u = data.user;
        setLogin(u.username || "");
        setFirstName(u.first_name || "");
        setLastName(u.last_name || "");
        setBirthDate(isoToBirthDisplay(u.birth_date));
        setGender(u.gender || "");
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Не вдалося завантажити профіль");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!avatarTip) return;
    const t = setTimeout(() => setAvatarTip(false), 2200);
    return () => clearTimeout(t);
  }, [avatarTip]);

  const save = async () => {
    const username = login.trim();
    if (!username) {
      setError("Логін обовʼязковий");
      return;
    }
    const birthIso = birthDisplayToIso(birthDate);
    if (birthDate.trim() && birthIso === null) {
      setError("Дата у форматі ДД.ММ.РРРР");
      return;
    }
    setSaving(true);
    setError("");
    setOkMsg("");
    try {
      const res = await fetch(`${API_URL}/api/me`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          username,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_date: birthIso || null,
          gender,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const messages = {
          "username already taken": "Такий логін уже зайнятий",
          "login and password required": "Логін обовʼязковий",
          "invalid profile": "Перевірте введені дані",
        };
        setError(messages[data.error] || "Не вдалося зберегти");
        return;
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, data.user.username);
      localStorage.setItem(ROLE_KEY, data.user.role || "user");
      onSaved?.(data.user);
      setBirthDate(isoToBirthDisplay(data.user.birth_date));
      setOkMsg("Збережено");
    } catch {
      setError("Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  };

  const initials = (login || "?").slice(0, 2).toUpperCase();

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: NEU_BG,
      display: "flex",
      flexDirection: "column",
      zIndex: 20,
      animation: "fadeUp 0.2s ease both",
    }}>
      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="neu-press"
          onClick={() => onClose()}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "none", background: NEU_BG,
            boxShadow: neu(false, 4, 8),
            cursor: "pointer",
            fontSize: 18, fontWeight: 800, color: "#6b8fb5",
          }}
        >←</button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#4b5563" }}>Профіль</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af" }}>Ці дані видно тільки Вам</div>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 20px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}>
        {loading ? (
          <div style={{ marginTop: 40, fontSize: 13, fontWeight: 600, color: "#9ca3af" }}>Завантаження...</div>
        ) : (
          <>
            <div style={{ position: "relative", marginBottom: 4 }}>
              <button
                className="neu-press"
                onClick={() => setAvatarTip(true)}
                style={{
                  width: 88, height: 88, borderRadius: "50%",
                  border: "none", background: NEU_BG,
                  boxShadow: neu(false, 6, 12),
                  cursor: "pointer",
                  fontSize: 22, fontWeight: 800, color: "#c084a0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {initials}
              </button>
              {avatarTip && (
                <div style={{
                  position: "absolute",
                  left: "50%",
                  bottom: -42,
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                  padding: "8px 12px",
                  borderRadius: 14,
                  background: NEU_BG,
                  boxShadow: neu(false, 3, 6),
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#6b8fb5",
                  zIndex: 2,
                }}>
                  ми ще робимо цю фічу
                </div>
              )}
            </div>

            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: avatarTip ? 28 : 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", paddingLeft: 8 }}>Логін</label>
              <NeuField value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Логін" />

              <label style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", paddingLeft: 8 }}>Імʼя</label>
              <NeuField value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Імʼя" />

              <label style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", paddingLeft: 8 }}>Прізвище</label>
              <NeuField value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Прізвище" />

              <label style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", paddingLeft: 8 }}>Дата народження</label>
              <NeuField
                value={birthDate}
                onChange={(e) => setBirthDate(formatBirthInput(e.target.value))}
                placeholder="ДД.ММ.РРРР"
              />

              <label style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", paddingLeft: 8 }}>Стать</label>
              <div style={{ display: "flex", gap: 8 }}>
                {GENDER_OPTIONS.map((opt) => {
                  const active = gender === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className="neu-press"
                      onClick={() => setGender(active ? "" : opt.value)}
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        border: "none",
                        borderRadius: 50,
                        background: NEU_BG,
                        boxShadow: active ? neu(true, 3, 6) : neu(false, 3, 6),
                        cursor: "pointer",
                        fontFamily: "'Nunito', sans-serif",
                        fontSize: 13,
                        fontWeight: 800,
                        color: active ? "#6b8fb5" : "#9ca3af",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center" }}>{error}</div>
            )}
            {okMsg && (
              <div style={{ fontSize: 12, fontWeight: 700, color: "#86efac", textAlign: "center" }}>{okMsg}</div>
            )}

            <button
              className="neu-press"
              onClick={save}
              disabled={saving}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "13px 0",
                borderRadius: 50,
                border: "none",
                background: NEU_BG,
                cursor: saving ? "default" : "pointer",
                fontFamily: "'Nunito', sans-serif",
                fontSize: 14, fontWeight: 800,
                color: "#6b8fb5",
                boxShadow: neu(false, 4, 8),
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Збереження..." : "Зберегти"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setPassword2("");
    setGender("");
  };

  const saveSession = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, data.user.username);
    localStorage.setItem(ROLE_KEY, data.user.role || "user");
    onAuth({ username: data.user.username, role: data.user.role || "user" });
  };

  const handleSubmit = async () => {
    const username = login.trim();
    if (!username || !password) {
      setError("Заповніть логін і пароль");
      return;
    }
    if (isRegister && password !== password2) {
      setError("Паролі не співпадають");
      return;
    }
    if (isRegister && gender !== "male" && gender !== "female") {
      setError("Оберіть стать");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister
          ? { username, password, password_confirm: password2, gender }
          : { username, password }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const messages = {
          "login and password required": "Заповніть логін і пароль",
          "passwords do not match": "Паролі не співпадають",
          "gender required": "Оберіть стать",
          "username already taken": "Такий логін уже зайнятий",
          "invalid credentials": "Невірний логін або пароль",
        };
        setError(messages[data.error] || (isRegister ? "Не вдалося зареєструватися" : "Не вдалося увійти"));
        return;
      }

      saveSession(data);
    } catch {
      setError(isRegister ? "Не вдалося зареєструватися" : "Не вдалося увійти");
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: NEU_BG,
      fontFamily: "'Nunito', sans-serif",
    }}>
      <AppStyles />
      <div style={{
        width: 320,
        background: NEU_BG,
        borderRadius: 28,
        boxShadow: `9px 9px 18px ${SHADOW_D}, -9px -9px 18px ${SHADOW_L}`,
        padding: "40px 32px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: NEU_BG,
          boxShadow: neu(false, 6, 12),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28,
        }}>
          👤
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#4b5563" }}>
            {isRegister ? "Реєстрація" : "Вхід"}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 4 }}>
            {isRegister ? "Створіть акаунт щоб почати чат" : "Увійдіть щоб продовжити чат"}
          </div>
        </div>

        <NeuField
          value={login}
          onChange={e => setLogin(e.target.value)}
          onKey={onKey}
          placeholder="Логін"
          autoFocus
        />
        <NeuField
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKey={onKey}
          placeholder="Пароль"
        />
        {isRegister && (
          <>
            <NeuField
              type="password"
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              onKey={onKey}
              placeholder="Пароль ще раз"
            />
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", paddingLeft: 8 }}>Стать</label>
              <div style={{ display: "flex", gap: 8 }}>
                {GENDER_OPTIONS.map((opt) => {
                  const active = gender === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className="neu-press"
                      onClick={() => setGender(opt.value)}
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        border: "none",
                        borderRadius: 50,
                        background: NEU_BG,
                        boxShadow: active ? neu(true, 3, 6) : neu(false, 3, 6),
                        cursor: "pointer",
                        fontFamily: "'Nunito', sans-serif",
                        fontSize: 13,
                        fontWeight: 800,
                        color: active ? "#6b8fb5" : "#9ca3af",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {error && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center" }}>
            {error}
          </div>
        )}

        <button
          className="neu-press"
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%",
            padding: "13px 0",
            borderRadius: 50,
            border: "none",
            background: NEU_BG,
            cursor: loading ? "default" : "pointer",
            fontFamily: "'Nunito', sans-serif",
            fontSize: 14, fontWeight: 800,
            color: "#6b8fb5",
            boxShadow: neu(false, 4, 8),
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? (isRegister ? "Реєстрація..." : "Вхід...")
            : (isRegister ? "Зареєструватися →" : "Увійти →")}
        </button>

        <button
          className="neu-press-soft"
          onClick={() => switchMode(isRegister ? "login" : "register")}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            color: "#9ca3af",
          }}
        >
          {isRegister ? "Вже є акаунт? Увійти" : "Немає акаунта? Зареєструватися"}
        </button>
      </div>
    </div>
  );
}

function ConversationsScreen({ onOpen, onLogout, onlineUsers, chats, isHead, adminUsers, onOpenUser }) {
  const online = onlineUsers ?? new Set();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [listMode, setListMode] = useState("chats"); // chats | users

  useEffect(() => {
    const q = query.trim();
    if (!q || listMode !== "chats") {
      return;
    }
    const t = setTimeout(() => {
      fetch(`${API_URL}/api/users?q=${encodeURIComponent(q)}`, { headers: authHeaders() })
        .then(res => res.json())
        .then(data => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, listMode]);

  const openUser = async (peer) => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ username: peer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === "cannot chat with yourself"
          ? "Не можна писати самому собі"
          : "Не вдалося відкрити чат");
        return;
      }
      onOpen({ id: data.id, peer: data.peer, peer_gender: data.peer_gender || "", unread_count: data.unread_count || 0 });
    } catch {
      setError("Не вдалося відкрити чат");
    }
  };

  const showSearch = listMode === "chats" && query.trim().length > 0;
  const filteredAdminUsers = (adminUsers || []).filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (u.username || "").toLowerCase().includes(q);
  });

  const formatLastSeen = (iso) => {
    if (!iso) return "ще не заходив";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "ще не заходив";
    return d.toLocaleString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      {isHead && (
        <div style={{ display: "flex", gap: 8, padding: "12px 20px 0" }}>
          {[
            { id: "chats", label: "Чати" },
            { id: "users", label: "Усі юзери" },
          ].map((tab) => {
            const active = listMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className="neu-press"
                onClick={() => { setListMode(tab.id); setQuery(""); setError(""); }}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  border: "none",
                  borderRadius: 50,
                  background: NEU_BG,
                  boxShadow: active ? neu(true, 3, 6) : neu(false, 3, 6),
                  cursor: "pointer",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 12,
                  fontWeight: 800,
                  color: active ? "#6b8fb5" : "#9ca3af",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ padding: "16px 20px 8px" }}>
        <NeuField
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={listMode === "users" ? "Фільтр юзерів..." : "Пошук за логіном..."}
        />
      </div>

      {error && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center", padding: "0 20px 8px" }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 16px" }}>
        {listMode === "users" ? (
          filteredAdminUsers.length === 0 ? (
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 24 }}>
              Немає користувачів
            </div>
          ) : filteredAdminUsers.map((u) => {
            const isOnline = !!u.online || online.has(u.username);
            const onCol = onlineColor(u.gender);
            return (
              <button
                key={u.id}
                className="neu-press"
                onClick={() => (onOpenUser ? onOpenUser(u.username) : openUser(u.username))}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  marginBottom: 10,
                  border: "none",
                  borderRadius: 18,
                  background: NEU_BG,
                  boxShadow: neu(false, 3, 6),
                  cursor: "pointer",
                  fontFamily: "'Nunito', sans-serif",
                  textAlign: "left",
                }}
              >
                <div style={{ position: "relative" }}>
                  <Avatar initials={u.username.slice(0, 2).toUpperCase()} color="#6b8fb5" />
                  <div style={{
                    position: "absolute", bottom: 0, right: 0,
                    width: 9, height: 9, borderRadius: "50%",
                    background: isOnline ? onCol : ONLINE_OFF,
                    boxShadow: `0 0 0 2px ${NEU_BG}`,
                  }}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#4b5563" }}>
                    {u.username}
                    {u.role && u.role !== "user" ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}> · {u.role}</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isOnline ? onCol : ONLINE_OFF_TEXT }}>
                    {isOnline ? "● Online" : formatLastSeen(u.last_seen)}
                  </div>
                </div>
              </button>
            );
          })
        ) : showSearch ? (
          results.length === 0 ? (
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 24 }}>
              Нікого не знайдено
            </div>
          ) : results.map(u => {
            const isOnline = online.has(u.username);
            const onCol = onlineColor(u.gender);
            return (
            <button
              key={u.id}
              className="neu-press"
              onClick={() => openUser(u.username)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                marginBottom: 10,
                border: "none",
                borderRadius: 18,
                background: NEU_BG,
                boxShadow: neu(false, 3, 6),
                cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
                textAlign: "left",
              }}
            >
              <div style={{ position: "relative" }}>
                <Avatar initials={u.username.slice(0, 2).toUpperCase()} color="#6b8fb5" />
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 9, height: 9, borderRadius: "50%",
                  background: isOnline ? onCol : ONLINE_OFF,
                  boxShadow: `0 0 0 2px ${NEU_BG}`,
                }}/>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#4b5563" }}>{u.username}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isOnline ? onCol : ONLINE_OFF_TEXT }}>
                  {isOnline ? "● Online" : "Offline"}
                </div>
              </div>
            </button>
            );
          })
        ) : chats.length === 0 ? (
          <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 24, padding: "0 12px" }}>
            Немає діалогів. Знайдіть користувача за логіном
          </div>
        ) : chats.map(c => {
          const isOnline = online.has(c.peer);
          const onCol = onlineColor(c.peer_gender);
          const unread = Number(c.unread_count) || 0;
          return (
          <button
            key={c.id}
            className="neu-press"
            onClick={() => onOpen({ id: c.id, peer: c.peer, peer_gender: c.peer_gender || "" })}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              marginBottom: 10,
              border: "none",
              borderRadius: 18,
              background: NEU_BG,
              boxShadow: neu(false, 3, 6),
              cursor: "pointer",
              fontFamily: "'Nunito', sans-serif",
              textAlign: "left",
            }}
          >
            <div style={{ position: "relative" }}>
              <Avatar initials={c.peer.slice(0, 2).toUpperCase()} color="#c084a0" />
              <div style={{
                position: "absolute", bottom: 0, right: 0,
                width: 9, height: 9, borderRadius: "50%",
                background: isOnline ? onCol : ONLINE_OFF,
                boxShadow: `0 0 0 2px ${NEU_BG}`,
              }}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#4b5563" }}>{c.peer}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: isOnline ? onCol : ONLINE_OFF_TEXT }}>
                {isOnline ? "● Online" : "Offline"}
              </div>
            </div>
            {unread > 0 && (
              <div style={{
                minWidth: 22,
                height: 22,
                padding: "0 7px",
                borderRadius: 50,
                background: "#c084a0",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: neu(false, 2, 4),
              }}>
                {unread > 99 ? "99+" : unread}
              </div>
            )}
          </button>
          );
        })}
      </div>
    </>
  );
}

export default function ChatPage() {
  const [username, setUsername] = useState(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const saved = localStorage.getItem(USER_KEY);
    return token && saved ? saved : null;
  });
  const [role, setRole] = useState(() => localStorage.getItem(ROLE_KEY) || "user");
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  const [onlineCount, setOnlineCount] = useState(0);
  const [myGender, setMyGender] = useState("");
  const [chats, setChats] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileHint, setProfileHint] = useState(
    () => localStorage.getItem(PROFILE_HINT_KEY) !== "1"
  );
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const skipSmooth = useRef(true);
  const activeChatRef = useRef(null);
  const [historyIds, setHistoryIds] = useState(() => new Set());
  const notificationSound = useRef(null);

  const applyAuth = (session) => {
    if (!session) {
      setUsername(null);
      setRole("user");
      return;
    }
    if (typeof session === "string") {
      setUsername(session);
      setRole(localStorage.getItem(ROLE_KEY) || "user");
      return;
    }
    setUsername(session.username);
    setRole(session.role || "user");
  };

  const loadChats = () => {
    fetch(`${API_URL}/api/conversations`, { headers: authHeaders() })
      .then(async res => {
        if (res.status === 401) {
          clearSession();
          applyAuth(null);
          return [];
        }
        return res.json();
      })
      .then(data => setChats(Array.isArray(data) ? data : []))
      .catch(() => setChats([]));
  };

  const loadAdminUsers = () => {
    fetch(`${API_URL}/api/admin/users`, { headers: authHeaders() })
      .then(async (res) => {
        if (res.status === 401) {
          clearSession();
          applyAuth(null);
          return [];
        }
        if (res.status === 403) return [];
        return res.json();
      })
      .then((data) => setAdminUsers(Array.isArray(data) ? data : []))
      .catch(() => setAdminUsers([]));
  };

  const markChatRead = (convId) => {
    if (!convId) return;
    setChats(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c));
    fetch(`${API_URL}/api/conversations/${convId}/read`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  };

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    notificationSound.current = createNotificationSound();
    return () => {
      notificationSound.current?.pause();
      notificationSound.current = null;
    };
  }, []);

  useEffect(() => {
    if (!username) {
      setChats([]);
      setAdminUsers([]);
      return;
    }
    loadChats();
  }, [username]);

  useEffect(() => {
    if (!username || !isHeadRole(role)) {
      setAdminUsers([]);
      return;
    }
    loadAdminUsers();
  }, [username, role]);

  useEffect(() => {
    if (!username) return;
    fetch(`${API_URL}/api/me`, { headers: authHeaders() })
      .then(async (res) => {
        if (res.status === 401) {
          clearSession();
          applyAuth(null);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data?.user?.username) return;
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, data.user.username);
        localStorage.setItem(ROLE_KEY, data.user.role || "user");
        setRole(data.user.role || "user");
        setMyGender(data.user.gender || "");
      })
      .catch(() => {});
  }, [username]);

  useEffect(() => {
    if (!username) {
      setOnlineUsers(new Set());
      setOnlineCount(0);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    const ws = new WebSocket(
      `${API_URL.replace("http", "ws")}/ws/presence?token=${encodeURIComponent(token || "")}`
    );

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (typeof data.online_count === "number") {
          setOnlineCount(data.online_count);
        }
        if (data.type === "presence_snapshot" && Array.isArray(data.online)) {
          setOnlineUsers(new Set(data.online));
          return;
        }
        if (data.type === "presence" && data.user) {
          setOnlineUsers(prev => {
            const next = new Set(prev);
            if (data.online) next.add(data.user);
            else next.delete(data.user);
            return next;
          });
          setAdminUsers(prev => {
            if (!prev.length) return prev;
            return prev.map((u) => {
              if (u.username !== data.user) return u;
              return {
                ...u,
                online: !!data.online,
                last_seen: data.online ? u.last_seen : (data.last_seen || new Date().toISOString()),
              };
            });
          });
          return;
        }
        if (data.type === "chat_message" && data.conversation_id) {
          if (data.from === username) return;
          const openId = activeChatRef.current?.id;
          if (openId === data.conversation_id) {
            markChatRead(data.conversation_id);
            return;
          }
          setChats(prev => {
            const idx = prev.findIndex(c => c.id === data.conversation_id);
            if (idx === -1) {
              loadChats();
              return prev;
            }
            const updated = [...prev];
            const cur = updated[idx];
            updated[idx] = { ...cur, unread_count: (Number(cur.unread_count) || 0) + 1 };
            return updated;
          });
          playNotification(notificationSound);
        }
      } catch (err) {
        console.error("Presence parse error:", err);
      }
    };

    ws.onclose = () => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    };

    return () => ws.close();
  }, [username]);

  useLayoutEffect(() => {
    if (!loaded) return;
    const list = listRef.current;
    if (!list) return;

    if (skipSmooth.current) {
      list.scrollTop = list.scrollHeight;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loaded]);

  useEffect(() => {
    if (!loaded) return;
    const id = requestAnimationFrame(() => {
      skipSmooth.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [loaded]);

  useEffect(() => {
    if (!username || !activeChat) return;

    fetch(`${API_URL}/api/conversations/${activeChat.id}/messages`, { headers: authHeaders() })
      .then(async res => {
        if (res.status === 401) {
          clearSession();
          applyAuth(null);
          return [];
        }
        return res.json();
      })
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setHistoryIds(new Set(list.map(m => m.id)));
        setMessages(list);
        setLoaded(true);
      });

    const token = localStorage.getItem(TOKEN_KEY);
    const ws = new WebSocket(
      `${API_URL.replace("http", "ws")}/ws?token=${encodeURIComponent(token || "")}&conversation_id=${activeChat.id}`
    );

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type || typeof msg.text !== "string" || !msg.time) return;
        let shouldNotify = false;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) {
            return prev.map(m => (m.id === msg.id ? msg : m));
          }
          // замінюємо тимчасове повідомлення на реальне
          const tempIndex = prev.findIndex(m =>
            typeof m.id === "string" && m.id.startsWith("temp-") && m.from === msg.from
          );
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = msg;
            return updated;
          }
          shouldNotify = msg.from !== username;
          return [...prev, msg];
        });

        if (shouldNotify) {
          playNotification(notificationSound);
        }
        if (msg.from !== username && activeChat?.id) {
          markChatRead(activeChat.id);
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    return () => ws.close();
  }, [username, activeChat]);

  const cancelEdit = () => {
    setEditingId(null);
    setInput("");
  };

  const cancelReply = () => setReplyTo(null);

  const startEdit = (msg) => {
    if (!canEditMessage(msg, username)) return;
    setReplyTo(null);
    setEditingId(msg.id);
    setInput(msg.text || "");
  };

  const startReply = (msg) => {
    if (!msg || typeof msg.id !== "number") return;
    // Reply only to the interlocutor's messages, never your own
    if (msg.from === username) return;
    setEditingId(null);
    setReplyTo({
      id: msg.id,
      from: msg.from,
      text: msg.text || "",
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !username || !activeChat) return;

    if (editingId != null) {
      const msgId = editingId;
      setEditingId(null);
      setInput("");
      try {
        const res = await fetch(`${API_URL}/api/conversations/${activeChat.id}/messages/${msgId}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ text }),
        });
        if (res.status === 401) {
          clearSession();
          applyAuth(null);
          return;
        }
        const savedMsg = await res.json().catch(() => ({}));
        if (!res.ok || typeof savedMsg.text !== "string") {
          return;
        }
        setMessages(prev => prev.map(m => m.id === msgId ? savedMsg : m));
      } catch (err) {
        console.error("Помилка редагування:", err);
      }
      return;
    }

    const replyTarget = replyTo;
    const tempId = "temp-" + Date.now();
    const tempMessage = {
      id: tempId,
      from: username,
      text,
      time: new Date().toISOString(),
      ...(replyTarget ? {
        reply_to: {
          id: replyTarget.id,
          from: replyTarget.from,
          text: replyTarget.text,
        },
      } : {}),
    };

    setMessages(prev => [...prev, tempMessage]);
    setInput("");
    setReplyTo(null);

    try {
      const res = await fetch(`${API_URL}/api/conversations/${activeChat.id}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          text,
          ...(replyTarget ? { reply_to: replyTarget.id } : {}),
        })
      });
      if (res.status === 401) {
        clearSession();
        applyAuth(null);
        return;
      }
      const savedMsg = await res.json();
      if (!res.ok || typeof savedMsg.text !== "string" || !savedMsg.time) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        return;
      }
      setMessages(prev => prev.map(m => m.id === tempId ? savedMsg : m));
    } catch (err) {
      console.error("Помилка відправки:", err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const onKey = (e) => {
    if (e.key === "Escape") {
      if (editingId != null) {
        e.preventDefault();
        cancelEdit();
        return;
      }
      if (replyTo) {
        e.preventDefault();
        cancelReply();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const openChat = (chat) => {
    skipSmooth.current = true;
    setHistoryIds(new Set());
    setMessages([]);
    setLoaded(false);
    setInput("");
    setEditingId(null);
    setReplyTo(null);
    setActiveChat(chat);
    setChats(prev => {
      const exists = prev.some(c => c.id === chat.id);
      if (exists) {
        return prev.map(c => c.id === chat.id
          ? { ...c, unread_count: 0, peer_gender: chat.peer_gender ?? c.peer_gender }
          : c);
      }
      return [{
        id: chat.id,
        peer: chat.peer,
        peer_gender: chat.peer_gender || "",
        unread_count: 0,
      }, ...prev];
    });
    markChatRead(chat.id);
  };

  const closeChat = () => {
    setActiveChat(null);
    setMessages([]);
    setLoaded(false);
    skipSmooth.current = true;
    setHistoryIds(new Set());
    setInput("");
    setEditingId(null);
    setReplyTo(null);
  };

  const logout = () => {
    clearSession();
    setMessages([]);
    setLoaded(false);
    skipSmooth.current = true;
    setHistoryIds(new Set());
    setActiveChat(null);
    setOnlineUsers(new Set());
    setOnlineCount(0);
    setMyGender("");
    setChats([]);
    setAdminUsers([]);
    setProfileOpen(false);
    applyAuth(null);
  };

  const peerOnline = activeChat ? onlineUsers.has(activeChat.peer) : false;
  const peerOnlineColor = onlineColor(activeChat?.peer_gender);
  const myOnlineColor = onlineColor(myGender);
  const showOnlineStats = isStaffRole(role);
  const isHead = isHeadRole(role);
  const headerInitials = (username || "?").slice(0, 2).toUpperCase();

  const openUserFromAdmin = async (peer) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ username: peer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      openChat({ id: data.id, peer: data.peer, peer_gender: data.peer_gender || "" });
    } catch {
      // ignore
    }
  };
  const openProfile = () => {
    if (profileHint) {
      localStorage.setItem(PROFILE_HINT_KEY, "1");
      setProfileHint(false);
    }
    setProfileOpen(true);
  };

  const closeProfile = (opts) => {
    setProfileOpen(false);
    if (opts?.logout) applyAuth(null);
  };

  const onProfileSaved = (user) => {
    applyAuth({ username: user.username, role: user.role || "user" });
    setMyGender(user.gender || "");
  };

  if (!username) {
    return <AuthScreen onAuth={applyAuth} />;
  }

  return (
    <>
      <AppStyles />

      <div style={{
        minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: NEU_BG,
        fontFamily: "'Nunito', sans-serif",
      }}>
        <div style={{
          width: 380, height: 620,
          background: NEU_BG,
          borderRadius: 28,
          boxShadow: `9px 9px 18px ${SHADOW_D}, -9px -9px 18px ${SHADOW_L}`,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}>

          {profileOpen && (
            <ProfileCard onClose={closeProfile} onSaved={onProfileSaved} />
          )}

          {/* Header */}
          <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            {activeChat ? (
              <button
                className="neu-press"
                onClick={closeChat}
                style={{
                  width: 44, height: 44, borderRadius: "50%",
                  border: "none", background: NEU_BG,
                  boxShadow: neu(false, 4, 8),
                  cursor: "pointer",
                  fontSize: 18, fontWeight: 800, color: "#6b8fb5",
                }}
              >←</button>
            ) : (
              <button
                className={`neu-press${profileHint ? " profile-hint-pulse" : ""}`}
                onClick={openProfile}
                style={{
                  position: "relative",
                  width: 44, height: 44, borderRadius: "50%",
                  border: "none", background: NEU_BG,
                  boxShadow: neu(false, 4, 8),
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800, color: "#c084a0",
                  fontFamily: "'Nunito', sans-serif",
                  padding: 0,
                }}
              >
                {headerInitials}
                <span style={{
                  position: "absolute", bottom: 1, right: 1,
                  width: 10, height: 10, borderRadius: "50%",
                  background: onlineUsers.has(username) ? myOnlineColor : ONLINE_OFF,
                  boxShadow: `0 0 0 2px ${NEU_BG}`,
                }}/>
              </button>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#4b5563" }}>
                {activeChat ? activeChat.peer : <><span style={{ color: "#868e99" }}>Bouble</span> Chat</>}
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: activeChat ? (peerOnline ? peerOnlineColor : ONLINE_OFF_TEXT) : "#9ca3af",
              }}>
                {activeChat
                  ? (peerOnline ? "● Online" : "Offline")
                  : (showOnlineStats ? `Онлайн зараз: ${onlineCount}` : "Приватні чати")}
              </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af" }}>
                {username}{showOnlineStats ? ` · ${role}` : ""}
              </div>
              <button
                className="neu-press-soft"
                onClick={logout}
                style={{
                  marginTop: 2,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#c084a0",
                  padding: 0,
                }}
              >
                Вийти
              </button>
            </div>
          </div>

          {!activeChat ? (
            <ConversationsScreen
              onOpen={openChat}
              onLogout={logout}
              onlineUsers={onlineUsers}
              chats={chats}
              isHead={isHead}
              adminUsers={adminUsers}
              onOpenUser={openUserFromAdmin}
            />
          ) : (
            <>
          {/* Messages */}
          <div ref={listRef} style={{
            flex: 1, overflowY: "auto",
            padding: "16px 18px",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              textAlign: "center",
              fontSize: 11, fontWeight: 700, color: "#9ca3af",
              marginBottom: 18,
              alignSelf: "center",
              padding: "4px 14px",
              borderRadius: 50,
              boxShadow: neu(true, 2, 5),
            }}>
              Сьогодні
            </div>

            {messages.map(msg => (
              <Bubble
                key={msg.id}
                msg={msg}
                username={username}
                animate={!historyIds.has(msg.id)}
                onEdit={startEdit}
                onReply={startReply}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {editingId != null && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 4px",
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#6b8fb5" }}>Редагування</span>
                <button
                  className="neu-press-soft"
                  onClick={cancelEdit}
                  style={{
                    border: "none", background: "transparent", cursor: "pointer",
                    fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700, color: "#9ca3af",
                  }}
                >Скасувати</button>
              </div>
            )}
            {replyTo && editingId == null && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px",
                borderRadius: 16,
                background: NEU_BG,
                boxShadow: neu(true, 2, 5),
              }}>
                <div style={{
                  width: 3, alignSelf: "stretch", borderRadius: 2, background: "#c084a0", flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#c084a0" }}>
                    Відповідь · {replyTo.from}
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "#6b7280",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {replyTo.text}
                  </div>
                </div>
                <button
                  className="neu-press-soft"
                  onClick={cancelReply}
                  style={{
                    border: "none", background: "transparent", cursor: "pointer",
                    fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700, color: "#9ca3af",
                  }}
                >✕</button>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center",
              background: NEU_BG, borderRadius: 50,
              boxShadow: neu(true, 4, 8), padding: "0 16px",
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder={
                  editingId != null
                    ? "Змінити повідомлення..."
                    : (replyTo ? "Написати відповідь..." : "Написати повідомлення...")
                }
                style={{
                  flex: 1, border: "none", outline: "none",
                  background: "transparent",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 13, fontWeight: 600,
                  color: "#4b5563", padding: "13px 0",
                }}
              />
              <button className="neu-press-soft" style={{
                border: "none", background: "transparent",
                cursor: "pointer", fontSize: 17, padding: "0 0 0 8px", color: "#9ca3af",
              }}>😊</button>
            </div>

            {/* кнопка відправки — повернули стилі і іконку */}
            <button
              className="neu-press neu-press-send"
              onClick={send}
              style={{
                width: 46, height: 46, borderRadius: "50%",
                border: "none", background: "#868e99",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: neu(false, 4, 8),
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
            </div>
          </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}