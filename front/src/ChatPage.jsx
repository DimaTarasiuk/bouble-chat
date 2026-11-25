import { useState, useRef, useEffect, useLayoutEffect } from "react";
import notificationMp3 from "./static/bulk-10.mp3";
import {
  API_URL,
  TOKEN_KEY,
  USER_KEY,
  ROLE_KEY,
  PROFILE_HINT_KEY,
  isStaffRole,
  isHeadRole,
  authHeaders,
  clearSession,
  ONLINE_OFF,
  ONLINE_OFF_TEXT,
  ONLINE_DOT_SHADOW,
  NAME_ABBR,
  NOTIFY_BADGE,
  onlineColor,
  formatDateTime,
  NEU_BG,
  SHADOW_D,
  SHADOW_L,
  neu,
  haptic,
  MIN_PASSWORD_LEN,
  MAX_MESSAGE_LEN,
  MESSAGES_PAGE_SIZE,
  openSocket,
  EMOJIS,
  PANE_DIVIDER,
  DESKTOP_QUERY,
  PHONE_QUERY,
  useMediaQuery,
  canEditMessage,
} from "./shared.js";
import { Avatar, NeuField, AppStyles, BooblifyLogo, Bubble } from "./ui.jsx";
import UserCard from "./admin/UserCard.jsx";
import StatsPanel from "./admin/StatsPanel.jsx";
import AnnouncementsPanel from "./admin/AnnouncementsPanel.jsx";
import FeedbackPanel from "./admin/FeedbackPanel.jsx";
import RandomMonitor from "./admin/RandomMonitor.jsx";
import FeedbackForm from "./FeedbackForm.jsx";
import AnnouncementPopup from "./AnnouncementPopup.jsx";

const mergeAnnouncements = (prev, incoming) => {
  const seen = new Set(prev.map((a) => a.id));
  const added = incoming.filter((a) => a?.id && !seen.has(a.id));
  if (!added.length) return prev;
  return [...prev, ...added].sort((a, b) => a.id - b.id);
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
  }
};

function UnreadBadge({ count, small = false }) {
  const [prevCount, setPrevCount] = useState(count);
  const [pulse, setPulse] = useState(0);
  if (count !== prevCount) {
    setPrevCount(count);
    if (count > prevCount) setPulse((p) => p + 1);
  }

  const label = count > 99 ? "99+" : count;
  const sizing = small
    ? { minWidth: 15, height: 15, padding: "0 4px", fontSize: 9 }
    : { minWidth: 22, height: 22, padding: "0 7px", fontSize: 11, boxShadow: neu(false, 2, 4) };

  return (
    <span
      key={pulse}
      className={`unread-badge${pulse > 0 ? " pop" : ""}`}
      style={{ background: NOTIFY_BADGE, ...sizing }}
    >
      <span className="unread-badge-ring" style={{ background: NOTIFY_BADGE }} aria-hidden="true" />
      <span key={label} className="unread-badge-num">{label}</span>
    </span>
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
                  fontSize: 22, fontWeight: 800, color: NAME_ABBR,
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

function AuthScreen({ onAuth, notice = "", onOpenRandom }) {
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
    if (isRegister && password.length < MIN_PASSWORD_LEN) {
      setError(`Пароль має бути щонайменше ${MIN_PASSWORD_LEN} символів`);
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
          "banned": "Акаунт заблоковано",
          "password too short": `Пароль має бути щонайменше ${MIN_PASSWORD_LEN} символів`,
          "too many requests": "Забагато спроб, спробуйте пізніше",
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
        <BooblifyLogo size={28} />

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

        {notice && !error && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center" }}>
            {notice}
          </div>
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
            : (isRegister ? "Зареєструватися →" : "Увійти")}
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

        {onOpenRandom && (
          <button
            className="neu-press-soft"
            onClick={onOpenRandom}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "'Nunito', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              color: "#6b8fb5",
            }}
          >
            Інкогніто
          </button>
        )}
      </div>
    </div>
  );
}

const HIDE_HOLD_MS = 7000;
const SWIPE_WIDTH = 168;

function overlayStyle() {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    background: "rgba(75, 85, 99, 0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  };
}

function dialogCardStyle() {
  return {
    width: "100%",
    maxWidth: 340,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: "24px 22px",
    borderRadius: 24,
    background: NEU_BG,
    boxShadow: `9px 9px 18px ${SHADOW_D}, -9px -9px 18px ${SHADOW_L}`,
    fontFamily: "'Nunito', sans-serif",
  };
}

function pillButton(color, off) {
  return {
    flex: 1,
    padding: "12px 0",
    border: "none",
    borderRadius: 50,
    background: NEU_BG,
    boxShadow: neu(false, 4, 8),
    cursor: off ? "default" : "pointer",
    opacity: off ? 0.6 : 1,
    fontFamily: "'Nunito', sans-serif",
    fontSize: 14,
    fontWeight: 800,
    color,
  };
}

function ConfirmDialog({ title, onNo, onYes }) {
  return (
    <div onClick={onNo} style={overlayStyle()}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={dialogCardStyle()}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#4b5563", textAlign: "center" }}>{title}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="neu-press" onClick={onNo} style={pillButton("#9ca3af")}>Ні</button>
          <button type="button" className="neu-press" onClick={onYes} style={pillButton("#c084a0")}>Так</button>
        </div>
      </div>
    </div>
  );
}

function CodeDialog({ code, again, error, onCode, onAgain, onCancel, onSave }) {
  const ready = /^\d{4,8}$/.test(code) && code === again;
  return (
    <div onClick={onCancel} style={overlayStyle()}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={dialogCardStyle()}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#4b5563", textAlign: "center" }}>Код скритих чатів</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#c084a0", textAlign: "center", lineHeight: 1.45 }}>
          Запам’ятайте цей код, його неможливо відновити
        </div>
        <NeuField type="password" value={code} onChange={(e) => onCode(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Код, 4–8 цифр" autoFocus />
        <NeuField type="password" value={again} onChange={(e) => onAgain(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Повторіть код" />
        {error && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center" }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="neu-press" onClick={onCancel} style={pillButton("#9ca3af")}>Ні</button>
          <button type="button" className="neu-press" disabled={!ready} onClick={ready ? onSave : undefined} style={pillButton("#6b8fb5", !ready)}>Так</button>
        </div>
      </div>
    </div>
  );
}

function ChatRow({ chat, online, active, onOpen, onHide, vault, onUnhide, onDismiss }) {
  const [shift, setShift] = useState(0);
  const origin = useRef(null);
  const shiftRef = useRef(0);
  const holdTimer = useRef(null);
  const moved = useRef(false);
  const suppressClick = useRef(false);
  const isOnline = online.has(chat.peer);
  const onCol = onlineColor(chat.peer_gender);
  const unread = Number(chat.unread_count) || 0;

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY, shift: shiftRef.current, id: e.pointerId };
    moved.current = false;
    clearHold();
    if (!vault && onHide) {
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        suppressClick.current = true;
        haptic(18);
        onHide(chat);
      }, HIDE_HOLD_MS);
    }
  };

  const onPointerMove = (e) => {
    const start = origin.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 16 || Math.abs(dy) > 16) {
      clearHold();
      moved.current = true;
    }
    if (!vault) return;
    if (dx < 0 || start.shift < 0) {
      const next = Math.max(-SWIPE_WIDTH, Math.min(0, start.shift + dx));
      shiftRef.current = next;
      setShift(next);
    }
  };

  const onPointerUp = () => {
    clearHold();
    if (vault) {
      const next = shiftRef.current < -48 ? -SWIPE_WIDTH : 0;
      shiftRef.current = next;
      setShift(next);
      if (moved.current) suppressClick.current = true;
    }
    origin.current = null;
  };

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (shiftRef.current !== 0) {
      shiftRef.current = 0;
      setShift(0);
      return;
    }
    onOpen(chat);
  };

  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      {vault && (
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: 18,
          overflow: "hidden",
          display: "flex",
          justifyContent: "flex-end",
        }}>
          <button
            type="button"
            onClick={() => onUnhide(chat)}
            style={{
              width: SWIPE_WIDTH / 2,
              border: "none",
              background: "#6b8fb5",
              color: "#fff",
              fontFamily: "'Nunito', sans-serif",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >Повернути</button>
          <button
            type="button"
            onClick={() => onDismiss(chat)}
            style={{
              width: SWIPE_WIDTH / 2,
              border: "none",
              background: "#c084a0",
              color: "#fff",
              fontFamily: "'Nunito', sans-serif",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >Видалити</button>
        </div>
      )}
      <button
        type="button"
        className="neu-press"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          border: "none",
          borderRadius: 18,
          background: NEU_BG,
          boxShadow: active ? neu(true, 3, 6) : neu(false, 3, 6),
          cursor: "pointer",
          fontFamily: "'Nunito', sans-serif",
          textAlign: "left",
          transform: `translateX(${shift}px)`,
          position: "relative",
          touchAction: vault ? "pan-y" : "manipulation",
        }}
      >
        <div style={{ position: "relative" }}>
          <Avatar initials={chat.peer.slice(0, 2).toUpperCase()} color={NAME_ABBR} />
          <div style={{
            position: "absolute", bottom: 0, right: 0,
            width: 9, height: 9, borderRadius: "50%",
            background: isOnline ? onCol : ONLINE_OFF,
            boxShadow: ONLINE_DOT_SHADOW,
          }}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#4b5563" }}>{chat.peer}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: isOnline ? onCol : ONLINE_OFF_TEXT }}>
            {isOnline ? "● Online" : "Offline"}
          </div>
        </div>
        {unread > 0 && <UnreadBadge count={unread} />}
      </button>
    </div>
  );
}

function ConversationsScreen({
  onOpen, onlineUsers, chats, isHead, adminUsers, onOpenUser, onAdminUsersChanged,
  feedbackUnread = 0, feedbackTick = 0, onFeedbackSeen, activeChatId = null,
  statsInMain = false, randomInMain = false, listMode = "chats", onListModeChange,
  vault = false, onUnlock, onLock, onHide, onUnhide, onDismiss,
}) {
  const online = onlineUsers ?? new Set();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [cardUser, setCardUser] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const changeListMode = (mode) => onListModeChange?.(mode);

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
      onOpen({
        id: data.id,
        peer: data.peer,
        peer_gender: data.peer_gender || "",
        unread_count: data.unread_count || 0,
        hidden: !!data.hidden,
        dismissed: !!data.dismissed,
      });
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

  const formatLastSeen = (iso) => formatDateTime(iso, "ще не заходив");

  return (
    <>
      {isHead && (
        <div style={{ display: "flex", gap: 6, padding: "12px 16px 0" }}>
          {[
            { id: "chats", label: "Чати" },
            { id: "users", label: "Юзери" },
            { id: "stats", label: "Статистика" },
            { id: "random", label: "Інкогніто" },
            { id: "news", label: "Оголошення" },
          ].map((tab) => {
            const active = listMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className="neu-press"
                onClick={() => { changeListMode(tab.id); setQuery(""); setError(""); }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 0",
                  border: "none",
                  borderRadius: 50,
                  background: NEU_BG,
                  boxShadow: active ? neu(true, 3, 6) : neu(false, 3, 6),
                  cursor: "pointer",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
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

      {cardUser && (
        <UserCard
          username={cardUser}
          online={online.has(cardUser)}
          onClose={() => setCardUser(null)}
          onOpenChat={(name) => {
            setCardUser(null);
            if (onOpenUser) onOpenUser(name);
            else openUser(name);
          }}
          onChanged={onAdminUsersChanged}
        />
      )}

      {(listMode === "chats" || listMode === "users") && (
        <div style={{ padding: "16px 20px 8px" }}>
          {vault && listMode === "chats" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#6b8fb5" }}>Скриті чати</span>
              <button
                type="button"
                className="neu-press"
                onClick={onLock}
                style={{
                  border: "none",
                  background: NEU_BG,
                  boxShadow: neu(false, 3, 6),
                  borderRadius: 50,
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#9ca3af",
                }}
              >Заблокувати</button>
            </div>
          )}
          <NeuField
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={listMode === "users" ? "Фільтр юзерів..." : "Пошук за логіном..."}
            onKey={(e) => {
              if (e.key !== "Enter" || listMode !== "chats") return;
              const q = query.trim();
              if (!/^\d{4,8}$/.test(q) || !onUnlock) return;
              e.preventDefault();
              onUnlock(q).then((opened) => {
                if (opened) {
                  setQuery("");
                  setResults([]);
                  setError("");
                }
              });
            }}
          />
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center", padding: "0 20px 8px" }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 16px" }}>
        {listMode === "stats" ? (
          statsInMain ? (
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 24, padding: "0 12px" }}>
              Статистика відкрита праворуч →
            </div>
          ) : (
            <StatsPanel />
          )
        ) : listMode === "random" ? (
          randomInMain ? (
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 24, padding: "0 12px" }}>
              Інкогніто відкрито праворуч →
            </div>
          ) : (
            <RandomMonitor />
          )
        ) : listMode === "news" ? (
          <AnnouncementsPanel />
        ) : listMode === "feedback" ? (
          <FeedbackPanel reloadKey={feedbackTick} onSeen={onFeedbackSeen} />
        ) : listMode === "users" ? (
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
                onClick={() => setCardUser(u.username)}
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
                  <Avatar initials={u.username.slice(0, 2).toUpperCase()} color={NAME_ABBR} />
                  <div style={{
                    position: "absolute", bottom: 0, right: 0,
                    width: 9, height: 9, borderRadius: "50%",
                    background: isOnline ? onCol : ONLINE_OFF,
                    boxShadow: ONLINE_DOT_SHADOW,
                  }}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#4b5563" }}>
                    {u.username}
                    {u.role && u.role !== "user" ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}> · {u.role}</span>
                    ) : null}
                    {u.banned ? (
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#c084a0" }}> · бан</span>
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
                <Avatar initials={u.username.slice(0, 2).toUpperCase()} color={NAME_ABBR} />
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 9, height: 9, borderRadius: "50%",
                  background: isOnline ? onCol : ONLINE_OFF,
                  boxShadow: ONLINE_DOT_SHADOW,
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
            {vault ? "Немає скритих чатів" : "Немає діалогів. Знайдіть користувача за логіном"}
          </div>
        ) : chats.map(c => (
          <ChatRow
            key={c.id}
            chat={c}
            online={online}
            active={c.id === activeChatId}
            vault={vault}
            onOpen={onOpen}
            onHide={onHide}
            onUnhide={onUnhide}
            onDismiss={onDismiss}
          />
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "2px 0 10px" }}>
        <button
          type="button"
          onClick={() => {
            if (!isHead) {
              setFeedbackOpen(true);
              return;
            }
            changeListMode(listMode === "feedback" ? "chats" : "feedback");
            setQuery("");
            setError("");
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            border: "none",
            background: "transparent",
            padding: "4px 8px",
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            color: "#b8bfca",
          }}
        >
          {isHead ? (listMode === "feedback" ? "← back" : "feedbacks") : "feedback"}
          {isHead && listMode !== "feedback" && feedbackUnread > 0 && (
            <UnreadBadge count={feedbackUnread} small />
          )}
        </button>
      </div>

      {feedbackOpen && <FeedbackForm onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}

export default function ChatPage({ onOpenRandom }) {
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  const [onlineCount, setOnlineCount] = useState(0);
  const [myGender, setMyGender] = useState("");
  const [chats, setChats] = useState([]);
  const [hiddenMode, setHiddenMode] = useState(false);
  const [hiddenChats, setHiddenChats] = useState([]);
  const [hideTarget, setHideTarget] = useState(null);
  const [hideStep, setHideStep] = useState("ask");
  const [hideError, setHideError] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const [codeAgain, setCodeAgain] = useState("");
  const [dismissTarget, setDismissTarget] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [feedbackUnread, setFeedbackUnread] = useState(0);
  const [feedbackTick, setFeedbackTick] = useState(0);
  const [authNotice, setAuthNotice] = useState("");
  const [profileHint, setProfileHint] = useState(
    () => localStorage.getItem(PROFILE_HINT_KEY) !== "1"
  );
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const escapeRef = useRef(null);
  const [sidebarMode, setSidebarMode] = useState("chats");
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const emojiWrapRef = useRef(null);
  const skipSmooth = useRef(true);
  const activeChatRef = useRef(null);
  const hiddenModeRef = useRef(false);
  const hiddenIdsRef = useRef(new Set());
  const [historyIds, setHistoryIds] = useState(() => new Set());
  const [hasMore, setHasMore] = useState(false);
  const loadingOlderRef = useRef(false);
  const prependRef = useRef(null);
  const notificationSound = useRef(null);

  const applyAuth = (session) => {
    if (!session) {
      setUsername(null);
      setRole("user");
      setHiddenMode(false);
      setHiddenChats([]);
      setChats([]);
      setAdminUsers([]);
      setSidebarMode("chats");
      setOnlineUsers(new Set());
      setOnlineCount(0);
      return;
    }
    if (typeof session === "string") {
      setUsername(session);
      setRole(localStorage.getItem(ROLE_KEY) || "user");
      return;
    }
    setAuthNotice("");
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

  const logout = () => {
    clearSession();
    setMessages([]);
    setLoaded(false);
    skipSmooth.current = true;
    setHistoryIds(new Set());
    setHasMore(false);
    setActiveChat(null);
    setMyGender("");
    setProfileOpen(false);
    setAnnouncements([]);
    setFeedbackUnread(0);
    applyAuth(null);
  };

  const forceLogout = (reason) => {
    logout();
    setAuthNotice(reason === "banned" ? "Акаунт заблоковано" : "Вас відключив адміністратор");
  };

  const ackAnnouncement = (id) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    fetch(`${API_URL}/api/announcements/${id}/ack`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  };

  const markFeedbackRead = (lastId) => {
    setFeedbackUnread(0);
    if (!lastId) return;
    fetch(`${API_URL}/api/admin/feedback/read`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ last_id: lastId }),
    }).catch(() => {});
  };

  const markChatRead = (convId) => {
    if (!convId) return;
    setChats(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c));
    setHiddenChats(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c));
    fetch(`${API_URL}/api/conversations/${convId}/read`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  };

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    hiddenModeRef.current = hiddenMode;
    hiddenIdsRef.current = new Set(hiddenChats.map(c => c.id));
  }, [hiddenMode, hiddenChats]);

  useEffect(() => {
    notificationSound.current = createNotificationSound();
    return () => {
      notificationSound.current?.pause();
      notificationSound.current = null;
    };
  }, []);

  useEffect(() => {
    if (!username) return;
    loadChats();
  }, [username]);

  useEffect(() => {
    if (!username || !isHeadRole(role)) return;
    loadAdminUsers();
  }, [username, role]);

  useEffect(() => {
    if (!username) return;
    fetch(`${API_URL}/api/me`, { headers: authHeaders() })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data.error === "banned") forceLogout("banned");
          else if (data.error === "session revoked") forceLogout("kicked");
          else {
            clearSession();
            applyAuth(null);
          }
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
    if (!username) return;
    let cancelled = false;
    fetch(`${API_URL}/api/announcements/pending`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setAnnouncements((prev) => mergeAnnouncements(prev, data));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [username]);

  useEffect(() => {
    if (!username || !isHeadRole(role)) return;
    let cancelled = false;
    fetch(`${API_URL}/api/admin/feedback/unread`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && typeof data?.count === "number") setFeedbackUnread(data.count);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [username, role]);

  useEffect(() => {
    if (!username) return;

    const ws = openSocket("/ws/presence");

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (typeof data.online_count === "number") {
          setOnlineCount(data.online_count);
        }
        if (data.type === "force_logout") {
          forceLogout(data.reason);
          return;
        }
        if (data.type === "announcement" && data.announcement?.id) {
          if (data.announcement.created_by === username) return;
          setAnnouncements((prev) => mergeAnnouncements(prev, [data.announcement]));
          return;
        }
        if (data.type === "feedback" && data.feedback?.id) {
          setFeedbackUnread((n) => n + 1);
          setFeedbackTick((n) => n + 1);
          return;
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
        if (data.type === "hidden_chat_message" && data.conversation_id) {
          if (!hiddenModeRef.current) return;
          const openId = activeChatRef.current?.id;
          if (openId === data.conversation_id) {
            markChatRead(data.conversation_id);
            return;
          }
          setHiddenChats(prev => {
            const idx = prev.findIndex(c => c.id === data.conversation_id);
            if (idx === -1) return prev;
            const updated = [...prev];
            const cur = updated[idx];
            updated[idx] = { ...cur, unread_count: (Number(cur.unread_count) || 0) + 1 };
            return updated;
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

    if (prependRef.current) {
      const { height, top } = prependRef.current;
      prependRef.current = null;
      list.scrollTop = list.scrollHeight - height + top;
      return;
    }

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

    fetch(`${API_URL}/api/conversations/${activeChat.id}/messages?limit=${MESSAGES_PAGE_SIZE}`, { headers: authHeaders() })
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
        setHasMore(list.length === MESSAGES_PAGE_SIZE);
        setLoaded(true);
      });

    const ws = openSocket(`/ws?conversation_id=${activeChat.id}`);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type || typeof msg.text !== "string" || !msg.time) return;
        let shouldNotify = false;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) {
            return prev.map(m => (m.id === msg.id ? msg : m));
          }
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

  const loadOlder = () => {
    if (!activeChat || !hasMore || loadingOlderRef.current) return;
    const oldest = messages.find((m) => typeof m.id === "number");
    if (!oldest) return;
    const chatId = activeChat.id;
    loadingOlderRef.current = true;
    fetch(
      `${API_URL}/api/conversations/${chatId}/messages?before=${oldest.id}&limit=${MESSAGES_PAGE_SIZE}`,
      { headers: authHeaders() }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (activeChatRef.current?.id !== chatId) return;
        const older = Array.isArray(data) ? data : [];
        setHasMore(older.length === MESSAGES_PAGE_SIZE);
        if (!older.length) return;
        const list = listRef.current;
        prependRef.current = list ? { height: list.scrollHeight, top: list.scrollTop } : null;
        setHistoryIds((prev) => {
          const next = new Set(prev);
          older.forEach((m) => next.add(m.id));
          return next;
        });
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          return [...older.filter((m) => !ids.has(m.id)), ...prev];
        });
      })
      .catch(() => {})
      .finally(() => {
        loadingOlderRef.current = false;
      });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setInput("");
  };

  const cancelReply = () => setReplyTo(null);

  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    const value = input || "";
    if (!el) {
      setInput(value + emoji);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch {
      }
    });
  };

  useEffect(() => {
    if (!emojiOpen) return;
    const onDown = (e) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [emojiOpen]);

  const startEdit = (msg) => {
    if (!canEditMessage(msg, username)) return;
    setReplyTo(null);
    setEditingId(msg.id);
    setInput(msg.text || "");
  };

  const startReply = (msg) => {
    if (!msg || typeof msg.id !== "number") return;
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
    setEmojiOpen(false);

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
      if (activeChat && !hiddenIdsRef.current.has(activeChat.id)) {
        setChats(prev => {
          if (prev.some(c => c.id === activeChat.id)) return prev;
          return [{
            id: activeChat.id,
            peer: activeChat.peer,
            peer_gender: activeChat.peer_gender || "",
            unread_count: 0,
          }, ...prev];
        });
      }
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
    if (chat.hidden && !hiddenModeRef.current) return;
    skipSmooth.current = true;
    setHistoryIds(new Set());
    setHasMore(false);
    setMessages([]);
    setLoaded(false);
    setInput("");
    setEditingId(null);
    setReplyTo(null);
    setEmojiOpen(false);
    setActiveChat(chat);
    const concealed = chat.hidden || hiddenIdsRef.current.has(chat.id);
    if (concealed) {
      setHiddenChats(prev => prev.map(c => c.id === chat.id
        ? { ...c, unread_count: 0, peer_gender: chat.peer_gender ?? c.peer_gender }
        : c));
    } else {
      setChats(prev => {
        const exists = prev.some(c => c.id === chat.id);
        if (!exists) return prev;
        return prev.map(c => c.id === chat.id
          ? { ...c, unread_count: 0, peer_gender: chat.peer_gender ?? c.peer_gender }
          : c);
      });
    }
    markChatRead(chat.id);
  };

  const lockVault = () => {
    const ids = hiddenIdsRef.current;
    const open = activeChatRef.current;
    setHiddenMode(false);
    setHiddenChats([]);
    if (open && ids.has(open.id)) closeChat();
  };

  const unlockVault = async (code) => {
    try {
      const res = await fetch(`${API_URL}/api/hidden/unlock`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) {
        clearSession();
        applyAuth(null);
        return false;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return false;
      setHiddenChats(Array.isArray(data.chats) ? data.chats : []);
      setHiddenMode(true);
      return true;
    } catch {
      return false;
    }
  };

  const postChatAction = async (id, action, body) => {
    const res = await fetch(`${API_URL}/api/conversations/${id}/${action}`, {
      method: "POST",
      headers: authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  const closeHide = () => {
    setHideTarget(null);
    setHideStep("ask");
    setHideError("");
    setCodeDraft("");
    setCodeAgain("");
  };

  const submitHide = async (code, confirm) => {
    if (!hideTarget) return;
    const { res, data } = await postChatAction(
      hideTarget.id,
      "hide",
      code ? { code, code_confirm: confirm } : {},
    );
    if (res.status === 401) {
      clearSession();
      applyAuth(null);
      return;
    }
    if (res.status === 409 && data.error === "code_required") {
      setHideStep("code");
      setHideError("");
      return;
    }
    if (!res.ok) {
      setHideError(data.error === "code mismatch"
        ? "Коди не співпадають"
        : "Код має бути від 4 до 8 цифр");
      setHideStep("code");
      return;
    }
    const id = hideTarget.id;
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatRef.current?.id === id) closeChat();
    closeHide();
  };

  const unhideChat = async (chat) => {
    const { res } = await postChatAction(chat.id, "unhide");
    if (res.status === 401) {
      clearSession();
      applyAuth(null);
      return;
    }
    if (!res.ok) return;
    setHiddenChats(prev => prev.filter(c => c.id !== chat.id));
    loadChats();
  };

  const dismissChat = async () => {
    if (!dismissTarget) return;
    const id = dismissTarget.id;
    const { res } = await postChatAction(id, "dismiss");
    setDismissTarget(null);
    if (res.status === 401) {
      clearSession();
      applyAuth(null);
      return;
    }
    if (!res.ok) return;
    setHiddenChats(prev => prev.filter(c => c.id !== id));
    if (activeChatRef.current?.id === id) closeChat();
  };

  const closeChat = () => {
    setActiveChat(null);
    setMessages([]);
    setLoaded(false);
    skipSmooth.current = true;
    setHistoryIds(new Set());
    setHasMore(false);
    setInput("");
    setEditingId(null);
    setReplyTo(null);
    setEmojiOpen(false);
  };

  const activeChatId = activeChat?.id ?? null;

  useEffect(() => {
    if (isDesktop && activeChatId && loaded) inputRef.current?.focus();
  }, [isDesktop, activeChatId, loaded]);

  useEffect(() => {
    escapeRef.current = () => {
      if (emojiOpen) setEmojiOpen(false);
      else closeChat();
    };
  });

  useEffect(() => {
    if (!isDesktop || !activeChatId) return;
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.target !== document.body && e.target !== inputRef.current) return;
      escapeRef.current?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDesktop, activeChatId]);

  const peerOnline = activeChat ? onlineUsers.has(activeChat.peer) : false;
  const peerOnlineColor = onlineColor(activeChat?.peer_gender);
  const myOnlineColor = onlineColor(myGender);
  const showOnlineStats = isStaffRole(role);
  const isHead = isHeadRole(role);
  const headerInitials = (username || "?").slice(0, 2).toUpperCase();
  const statsInMain = isDesktop && isHead && sidebarMode === "stats";
  const randomInMain = isDesktop && isHead && sidebarMode === "random";

  const changeSidebarMode = (mode) => {
    if (mode !== "chats") lockVault();
    setSidebarMode(mode);
    if ((mode === "stats" || mode === "random") && isDesktop && activeChat) closeChat();
  };

  const openUserFromAdmin = async (peer) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ username: peer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      openChat({
        id: data.id,
        peer: data.peer,
        peer_gender: data.peer_gender || "",
        hidden: !!data.hidden,
        dismissed: !!data.dismissed,
      });
    } catch {
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
    return <AuthScreen onAuth={applyAuth} notice={authNotice} onOpenRandom={onOpenRandom} />;
  }

  const accountBox = (
    <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
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
  );

  const listHeader = (
    <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12 }}>
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
          fontSize: 14, fontWeight: 800, color: NAME_ABBR,
          fontFamily: "'Nunito', sans-serif",
          padding: 0,
          flexShrink: 0,
        }}
      >
        {headerInitials}
        <span style={{
          position: "absolute", bottom: 1, right: 1,
          width: 10, height: 10, borderRadius: "50%",
          background: onlineUsers.has(username) ? myOnlineColor : ONLINE_OFF,
          boxShadow: ONLINE_DOT_SHADOW,
        }}/>
      </button>
      <div style={{ minWidth: 0 }}>
        <div><BooblifyLogo /></div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af" }}>
          {showOnlineStats ? `Онлайн зараз: ${onlineCount}` : "Приватні чати"}
        </div>
      </div>
      {accountBox}
      {onOpenRandom && (
        <button
          className="neu-press"
          onClick={() => { lockVault(); onOpenRandom(); }}
          title="Інкогніто"
          aria-label="Інкогніто"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "none", background: NEU_BG,
            boxShadow: neu(false, 3, 6),
            cursor: "pointer",
            fontSize: 16,
            flexShrink: 0,
          }}
        >🎲</button>
      )}
    </div>
  );

  const chatHeader = activeChat && (
    <div style={{
      padding: "18px 20px",
      display: "flex", alignItems: "center", gap: 12,
      ...(isDesktop ? { borderBottom: `1px solid ${PANE_DIVIDER}` } : {}),
    }}>
      {isDesktop ? (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar initials={activeChat.peer.slice(0, 2).toUpperCase()} color={NAME_ABBR} />
          <div style={{
            position: "absolute", bottom: 0, right: 0,
            width: 9, height: 9, borderRadius: "50%",
            background: peerOnline ? peerOnlineColor : ONLINE_OFF,
            boxShadow: ONLINE_DOT_SHADOW,
          }}/>
        </div>
      ) : (
        <button
          className="neu-press"
          onClick={closeChat}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "none", background: NEU_BG,
            boxShadow: neu(false, 4, 8),
            cursor: "pointer",
            fontSize: 18, fontWeight: 800, color: "#6b8fb5",
            flexShrink: 0,
          }}
        >←</button>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 800, color: "#4b5563",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {activeChat.peer}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: peerOnline ? peerOnlineColor : ONLINE_OFF_TEXT }}>
          {peerOnline ? "● Online" : "Offline"}
        </div>
      </div>
      {isDesktop ? (
        <button
          className="neu-press"
          onClick={closeChat}
          title="Закрити чат (Esc)"
          style={{
            marginLeft: "auto",
            width: 36, height: 36, borderRadius: "50%",
            border: "none", background: NEU_BG,
            boxShadow: neu(false, 3, 6),
            cursor: "pointer",
            fontSize: 13, fontWeight: 800, color: "#9ca3af",
            flexShrink: 0,
          }}
        >✕</button>
      ) : accountBox}
    </div>
  );

  const conversations = (
    <ConversationsScreen
      onOpen={openChat}
      onlineUsers={onlineUsers}
      isHead={isHead}
      adminUsers={adminUsers}
      onOpenUser={openUserFromAdmin}
      onAdminUsersChanged={loadAdminUsers}
      feedbackUnread={feedbackUnread}
      feedbackTick={feedbackTick}
      onFeedbackSeen={markFeedbackRead}
      activeChatId={activeChat?.id ?? null}
      statsInMain={statsInMain}
      randomInMain={randomInMain}
      listMode={isHead ? sidebarMode : "chats"}
      onListModeChange={changeSidebarMode}
      vault={hiddenMode}
      chats={hiddenMode ? hiddenChats : chats}
      onUnlock={unlockVault}
      onLock={lockVault}
      onHide={(chat) => {
        setHideTarget(chat);
        setHideStep("ask");
        setHideError("");
        setCodeDraft("");
        setCodeAgain("");
      }}
      onUnhide={unhideChat}
      onDismiss={setDismissTarget}
    />
  );

  const chatBody = (
    <>
          <div ref={listRef} onScroll={(e) => { if (e.currentTarget.scrollTop < 80) loadOlder(); }} style={{
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

          <div
            ref={emojiWrapRef}
            style={{
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minWidth: 0,
            }}
          >
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
            {emojiOpen && (
              <div style={{
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                maxHeight: 196,
                overflowY: "auto",
                overflowX: "hidden",
                padding: 8,
                borderRadius: 18,
                background: NEU_BG,
                boxShadow: neu(false, 5, 12),
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
                gap: 2,
                justifyItems: "center",
                alignItems: "center",
              }}>
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    className="neu-press-soft"
                    onClick={() => insertEmoji(em)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 20,
                      lineHeight: 1,
                      width: "100%",
                      maxWidth: 40,
                      aspectRatio: "1",
                      padding: 0,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
              flex: 1, display: "flex", alignItems: "center",
              background: NEU_BG, borderRadius: 50,
              boxShadow: neu(true, 4, 8), padding: "0 16px",
              minWidth: 0,
            }}>
              <input
                ref={inputRef}
                value={input}
                maxLength={MAX_MESSAGE_LEN}
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
                  fontSize: 16, fontWeight: 600,
                  color: "#4b5563", padding: "13px 0",
                  minWidth: 0,
                }}
              />
              <button
                type="button"
                className="neu-press-soft"
                onClick={() => setEmojiOpen((v) => !v)}
                aria-label="Емодзі"
                style={{
                  border: "none", background: "transparent",
                  cursor: "pointer", fontSize: 17, padding: "0 0 0 8px",
                  color: emojiOpen ? "#6b8fb5" : "#9ca3af",
                  flexShrink: 0,
                }}
              >😊</button>
            </div>

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
  );

  const emptyPane = (
    <div style={{
      flex: 1,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 14, padding: 24, textAlign: "center",
    }}>
      <div style={{
        width: 84, height: 84, borderRadius: "50%",
        background: NEU_BG, boxShadow: neu(false, 6, 14),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 34,
      }}>💬</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#4b5563" }}>Оберіть чат</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", maxWidth: 280, lineHeight: 1.5 }}>
        Виберіть діалог зліва або знайдіть користувача за логіном
      </div>
    </div>
  );

  const cardStyle = {
    background: NEU_BG,
    borderRadius: isPhone ? 0 : 28,
    boxShadow: isPhone ? "none" : `9px 9px 18px ${SHADOW_D}, -9px -9px 18px ${SHADOW_L}`,
    overflow: "hidden",
    position: "relative",
    display: "flex",
  };

  return (
    <>
      <AppStyles />
      <AnnouncementPopup queue={announcements} onAck={ackAnnouncement} />
      {hideTarget && hideStep === "ask" && (
        <ConfirmDialog
          title="Сховати чат?"
          onNo={closeHide}
          onYes={() => submitHide()}
        />
      )}
      {hideTarget && hideStep === "code" && (
        <CodeDialog
          code={codeDraft}
          again={codeAgain}
          error={hideError}
          onCode={setCodeDraft}
          onAgain={setCodeAgain}
          onCancel={closeHide}
          onSave={() => submitHide(codeDraft, codeAgain)}
        />
      )}
      {dismissTarget && (
        <ConfirmDialog
          title="Видалити чат назавжди?"
          onNo={() => setDismissTarget(null)}
          onYes={dismissChat}
        />
      )}

      <div style={{
        minHeight: "100dvh",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: NEU_BG,
        fontFamily: "'Nunito', sans-serif",
        padding: isDesktop ? 24 : 0,
      }}>
        {isDesktop ? (
          <div style={{
            ...cardStyle,
            width: "min(1200px, 100%)",
            height: "min(860px, calc(100dvh - 48px))",
            flexDirection: "row",
          }}>
            <aside style={{
              width: 370,
              flexShrink: 0,
              display: "flex", flexDirection: "column",
              position: "relative",
              borderRight: `1px solid ${PANE_DIVIDER}`,
            }}>
              {profileOpen && (
                <ProfileCard onClose={closeProfile} onSaved={onProfileSaved} />
              )}
              {listHeader}
              {conversations}
            </aside>
            <section style={{
              flex: 1, minWidth: 0,
              display: "flex", flexDirection: "column",
              position: "relative",
            }}>
              {activeChat
                ? <>{chatHeader}{chatBody}</>
                : statsInMain ? <StatsPanel wide />
                : randomInMain ? <RandomMonitor wide />
                : emptyPane}
            </section>
          </div>
        ) : (
          <div style={{
            ...cardStyle,
            width: isPhone ? "100%" : 380,
            height: isPhone ? "100dvh" : 620,
            flexDirection: "column",
          }}>
            {profileOpen && (
              <ProfileCard onClose={closeProfile} onSaved={onProfileSaved} />
            )}
            {activeChat ? <>{chatHeader}{chatBody}</> : <>{listHeader}{conversations}</>}
          </div>
        )}
      </div>
    </>
  );
}