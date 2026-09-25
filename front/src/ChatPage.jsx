import { useState, useRef, useEffect, useLayoutEffect } from "react";
import notificationMp3 from "./static/bulk-10.mp3";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:7979" : window.location.origin)
).replace(/\/$/, "");
const TOKEN_KEY = "chat_token";
const USER_KEY = "chat_username";

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

function Bubble({ msg, username, animate = false }) {
  const isMe = msg.from === username;
  const initials = (msg.from || "?").slice(0, 2).toUpperCase();

  return (
    <div style={{
      display: "flex",
      flexDirection: isMe ? "row-reverse" : "row",
      alignItems: "flex-end",
      gap: 10,
      marginBottom: 16,
      ...(animate ? { animation: "fadeUp 0.25s ease both" } : {}),
    }}>
      {!isMe && <Avatar initials={initials} color="#c084a0" />}

      <div style={{ maxWidth: "68%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
        {!isMe && (
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, marginBottom: 3, paddingLeft: 4 }}>
            {msg.from}
          </span>
        )}
        <div style={{
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
        }}>
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

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setPassword2("");
  };

  const saveSession = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, data.user.username);
    onAuth(data.user.username);
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

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister
          ? { username, password, password_confirm: password2 }
          : { username, password }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const messages = {
          "login and password required": "Заповніть логін і пароль",
          "passwords do not match": "Паролі не співпадають",
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
          <NeuField
            type="password"
            value={password2}
            onChange={e => setPassword2(e.target.value)}
            onKey={onKey}
            placeholder="Пароль ще раз"
          />
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

function ConversationsScreen({ onOpen, onLogout, onlineUsers }) {
  const online = onlineUsers ?? new Set();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [chats, setChats] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/conversations`, { headers: authHeaders() })
      .then(async res => {
        if (res.status === 401) {
          clearSession();
          onLogout();
          return [];
        }
        return res.json();
      })
      .then(data => setChats(Array.isArray(data) ? data : []))
      .catch(() => setChats([]));
  }, [onLogout]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      return;
    }
    const t = setTimeout(() => {
      fetch(`${API_URL}/api/users?q=${encodeURIComponent(q)}`, { headers: authHeaders() })
        .then(res => res.json())
        .then(data => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

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
      onOpen({ id: data.id, peer: data.peer });
    } catch {
      setError("Не вдалося відкрити чат");
    }
  };

  const showSearch = query.trim().length > 0;

  return (
    <>
      <div style={{ padding: "16px 20px 8px" }}>
        <NeuField
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Пошук за логіном..."
        />
      </div>

      {error && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center", padding: "0 20px 8px" }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 16px" }}>
        {showSearch ? (
          results.length === 0 ? (
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 24 }}>
              Нікого не знайдено
            </div>
          ) : results.map(u => {
            const isOnline = online.has(u.username);
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
                  background: isOnline ? "#86efac" : "#c5cad3",
                  boxShadow: `0 0 0 2px ${NEU_BG}`,
                }}/>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#4b5563" }}>{u.username}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isOnline ? "#86efac" : "#9ca3af" }}>
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
          return (
          <button
            key={c.id}
            className="neu-press"
            onClick={() => onOpen({ id: c.id, peer: c.peer })}
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
                background: isOnline ? "#86efac" : "#c5cad3",
                boxShadow: `0 0 0 2px ${NEU_BG}`,
              }}/>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#4b5563" }}>{c.peer}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: isOnline ? "#86efac" : "#9ca3af" }}>
                {isOnline ? "● Online" : "Offline"}
              </div>
            </div>
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
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const skipSmooth = useRef(true);
  const [historyIds, setHistoryIds] = useState(() => new Set());
  const notificationSound = useRef(null);

  useEffect(() => {
    notificationSound.current = createNotificationSound();
    return () => {
      notificationSound.current?.pause();
      notificationSound.current = null;
    };
  }, []);

  useEffect(() => {
    if (!username) {
      setOnlineUsers(new Set());
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    const ws = new WebSocket(
      `${API_URL.replace("http", "ws")}/ws/presence?token=${encodeURIComponent(token || "")}`
    );

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
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
          setUsername(null);
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
        setMessages(prev => {
          // замінюємо тимчасове повідомлення на реальне
          const tempIndex = prev.findIndex(m =>
            typeof m.id === "string" && m.id.startsWith("temp-") && m.from === msg.from
          );
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = msg;
            return updated;
          }
          // не додаємо дублікати
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        if (msg.from !== username) {
          playNotification(notificationSound);
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    return () => ws.close();
  }, [username, activeChat]);

  const send = async () => {
    const text = input.trim();
    if (!text || !username || !activeChat) return;

    const tempId = "temp-" + Date.now();
    const tempMessage = {
      id: tempId,
      from: username,
      text,
      time: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempMessage]);
    setInput("");

    try {
      const res = await fetch(`${API_URL}/api/conversations/${activeChat.id}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text })
      });
      if (res.status === 401) {
        clearSession();
        setUsername(null);
        return;
      }
      const savedMsg = await res.json();
      if (!res.ok || typeof savedMsg.text !== "string" || !savedMsg.time) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        return;
      }
      // замінюємо temp на збережене повідомлення з реальним id
      setMessages(prev => prev.map(m => m.id === tempId ? savedMsg : m));
    } catch (err) {
      console.error("Помилка відправки:", err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const openChat = (chat) => {
    skipSmooth.current = true;
    setHistoryIds(new Set());
    setMessages([]);
    setLoaded(false);
    setInput("");
    setActiveChat(chat);
  };

  const closeChat = () => {
    setActiveChat(null);
    setMessages([]);
    setLoaded(false);
    skipSmooth.current = true;
    setHistoryIds(new Set());
  };

  const logout = () => {
    clearSession();
    setMessages([]);
    setLoaded(false);
    skipSmooth.current = true;
    setHistoryIds(new Set());
    setActiveChat(null);
    setOnlineUsers(new Set());
    setUsername(null);
  };

  const peerOnline = activeChat ? onlineUsers.has(activeChat.peer) : false;

  if (!username) {
    return <AuthScreen onAuth={setUsername} />;
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
        }}>

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
              <div style={{ position: "relative" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: NEU_BG,
                  boxShadow: neu(false, 4, 8),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800, color: "#c084a0",
                }}>SB</div>
                <div style={{
                  position: "absolute", bottom: 1, right: 1,
                  width: 10, height: 10, borderRadius: "50%",
                  background: onlineUsers.has(username) ? "#86efac" : "#c5cad3",
                  boxShadow: `0 0 0 2px ${NEU_BG}`,
                }}/>
              </div>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#4b5563" }}>
                {activeChat ? activeChat.peer : <><span style={{ color: "#868e99" }}>Bouble</span> Chat</>}
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: activeChat ? (peerOnline ? "#86efac" : "#9ca3af") : "#9ca3af",
              }}>
                {activeChat ? (peerOnline ? "● Online" : "Offline") : "Приватні чати"}
              </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af" }}>
                {username}
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
            <ConversationsScreen onOpen={openChat} onLogout={logout} onlineUsers={onlineUsers} />
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
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center",
              background: NEU_BG, borderRadius: 50,
              boxShadow: neu(true, 4, 8), padding: "0 16px",
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Написати повідомлення..."
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
            </>
          )}

        </div>
      </div>
    </>
  );
}