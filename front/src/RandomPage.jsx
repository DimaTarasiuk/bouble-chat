import { useCallback, useEffect, useRef, useState } from "react";
import {
  API_URL,
  TOKEN_KEY,
  NEU_BG,
  SHADOW_D,
  SHADOW_L,
  GENDER_BUBBLE,
  MAX_MESSAGE_LEN,
  EMOJIS,
  PANE_DIVIDER,
  DESKTOP_QUERY,
  PHONE_QUERY,
  neu,
  onlineColor,
  openSocket,
  useMediaQuery,
} from "./shared.js";
import { AppStyles, Avatar, BooblifyLogo, Bubble, NeuField } from "./ui.jsx";

const RANDOM_TOKEN_KEY = "random_token";
const RANDOM_PREFS_KEY = "random_prefs";
const RANDOM_ANON_KEY = "random_anon_id";
const RECONNECT_MS = 1500;

function getAnonId() {
  try {
    let id = localStorage.getItem(RANDOM_ANON_KEY);
    if (!id && typeof crypto !== "undefined" && crypto.randomUUID) {
      id = crypto.randomUUID();
      localStorage.setItem(RANDOM_ANON_KEY, id);
    }
    return id || "";
  } catch {
    return "";
  }
}

function saveAnonId(id) {
  if (!id) return;
  try {
    localStorage.setItem(RANDOM_ANON_KEY, id);
  } catch {
  }
}
const MIN_AGE = 18;
const MAX_AGE = 99;

const EMPTY_FORM = { gender: "", age_band: "", seek_gender: "", seek_age_min: "18", seek_age_max: "35" };

const MY_GENDER_OPTIONS = [
  { value: "male", label: "Чоловік" },
  { value: "female", label: "Жінка" },
];

const SEEK_GENDER_OPTIONS = [
  { value: "male", label: "Чоловіка" },
  { value: "female", label: "Жінку" },
  { value: "any", label: "Будь-кого" },
];

const AGE_BANDS = [
  { value: "18-22", label: "18-22", min: 18, max: 22 },
  { value: "23-28", label: "23-28", min: 23, max: 28 },
  { value: "28-30+", label: "28-30+", min: 28, max: MAX_AGE },
];

const ageBandByValue = (value) => AGE_BANDS.find((b) => b.value === value) || null;
const ageBandByRange = (min, max) => AGE_BANDS.find((b) => b.min === min && b.max === max) || null;

const genderSign = (gender) => (gender === "female" ? "♀" : "♂");
const genderLabel = (gender) => (gender === "female" ? "Вона" : "Він");

const MALE_NICKS = [
  "Рандомний кіт", "Милий кіт", "Няшний кіт", "Дворовий кіт",
];

const FEMALE_NICKS = [
  "Рандомна кицька", "Мила кицька", "Няшна кицька", "Дворова кицька",
];

function peerNick(session) {
  const list = session.peer_gender === "female" ? FEMALE_NICKS : MALE_NICKS;
  const id = Number(session.id) || 0;
  return list[Math.abs(id) % list.length];
}

function loadForm() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RANDOM_PREFS_KEY));
    if (!saved) return EMPTY_FORM;
    const band = ageBandByRange(saved.age_min, saved.age_max);
    return {
      gender: saved.gender || "",
      age_band: band?.value || "",
      seek_gender: saved.seek_gender || "",
      seek_age_min: String(saved.seek_age_min ?? EMPTY_FORM.seek_age_min),
      seek_age_max: String(saved.seek_age_max ?? EMPTY_FORM.seek_age_max),
    };
  } catch {
    return EMPTY_FORM;
  }
}

function parseAge(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= MIN_AGE && n <= MAX_AGE ? n : null;
}

function clampSeekAge(raw) {
  if (raw === "" || raw == null) return String(MIN_AGE);
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(MIN_AGE);
  return String(Math.min(MAX_AGE, Math.max(MIN_AGE, Math.trunc(n))));
}

function validateForm(form) {
  if (!form.gender) return { error: "Оберіть свою стать" };
  const band = ageBandByValue(form.age_band);
  if (!band) return { error: "Оберіть свій вік" };
  if (!form.seek_gender) return { error: "Оберіть, кого шукаєте" };
  const min = parseAge(form.seek_age_min);
  const max = parseAge(form.seek_age_max);
  if (min === null || max === null) return { error: `Вік співрозмовника — від ${MIN_AGE} до ${MAX_AGE}` };
  if (min > max) return { error: "Вік «від» більший за «до»" };
  return {
    prefs: {
      gender: form.gender,
      age_min: band.min,
      age_max: band.max,
      seek_gender: form.seek_gender,
      seek_age_min: min,
      seek_age_max: max,
    },
  };
}

async function api(method, path, token, body) {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch {
    return { status: 0, ok: false, data: {} };
  }
}

const labelStyle = { fontSize: 11, fontWeight: 700, color: "#9ca3af", paddingLeft: 8 };
const sectionStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "14px 14px 16px",
  borderRadius: 22,
  background: NEU_BG,
  boxShadow: neu(false, 4, 10),
};

function Chips({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className="neu-press"
            onClick={() => onChange(opt.value)}
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
  );
}

function PillButton({ children, onClick, disabled, primary = false, style }) {
  return (
    <button
      className="neu-press"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "13px 22px",
        borderRadius: 50,
        border: "none",
        background: NEU_BG,
        cursor: disabled ? "default" : "pointer",
        fontFamily: "'Nunito', sans-serif",
        fontSize: 14,
        fontWeight: 800,
        color: primary ? "#6b8fb5" : "#9ca3af",
        boxShadow: neu(false, 4, 8),
        opacity: disabled ? 0.7 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default function RandomPage({ onOpenAccount }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [hasAccount] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  const [token, setToken] = useState(() => sessionStorage.getItem(RANDOM_TOKEN_KEY));
  const [phase, setPhase] = useState(() => (sessionStorage.getItem(RANDOM_TOKEN_KEY) ? "searching" : "form"));
  const [form, setForm] = useState(loadForm);
  const [starting, setStarting] = useState(false);
  const [confirmNext, setConfirmNext] = useState(false);
  const [error, setError] = useState("");

  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const phaseRef = useRef(phase);
  const sessionIdRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { sessionIdRef.current = session?.id ?? null; }, [session]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, phase]);

  const resetToForm = useCallback((message = "") => {
    sessionStorage.removeItem(RANDOM_TOKEN_KEY);
    setToken(null);
    setSession(null);
    setMessages([]);
    setReplyTo(null);
    setInput("");
    setEmojiOpen(false);
    setConfirmNext(false);
    setPhase("form");
    setError(message);
  }, []);

  const expire = useCallback(() => {
    resetToForm("Сесія завершилась, почніть пошук знову");
  }, [resetToForm]);

  const search = useCallback(async () => {
    setSession(null);
    setMessages([]);
    setReplyTo(null);
    setInput("");
    setEmojiOpen(false);
    setPhase("searching");
    const res = await api("POST", "/api/random/search", token);
    if (res.status === 401) return expire();
    if (res.status === 409) return;
    if (!res.ok) {
      setError("Не вдалося почати пошук");
      return;
    }
    if (res.data.status === "matched") {
      setSession(res.data.session);
      setPhase("chat");
    }
  }, [token, expire]);

  useEffect(() => {
    if (!token) return undefined;
    let ws = null;
    let timer = null;
    let disposed = false;

    const onEvent = (ev) => {
      if (ev.type === "matched") {
        setSession(ev.session);
        setMessages([]);
        setReplyTo(null);
        setInput("");
        setPhase("chat");
      } else if (ev.type === "message" && ev.message) {
        setMessages((prev) => (prev.some((m) => m.id === ev.message.id) ? prev : [...prev, { ...ev.message, isNew: true }]));
      } else if (ev.type === "peer_left" && ev.session_id === sessionIdRef.current) {
        setReplyTo(null);
        setPhase("peerLeft");
      }
    };

    const connect = () => {
      let opened = false;
      ws = openSocket("/ws/random", token);
      ws.onopen = () => {
        opened = true;
        setConnected(true);
      };
      ws.onmessage = (e) => {
        try {
          onEvent(JSON.parse(e.data));
        } catch {
        }
      };
      ws.onclose = async () => {
        setConnected(false);
        if (disposed) return;
        if (!opened) {
          const res = await api("GET", "/api/random/messages", token);
          if (disposed) return;
          if (res.status === 401) {
            expire();
            return;
          }
        }
        timer = setTimeout(connect, RECONNECT_MS);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [token, expire]);

  useEffect(() => {
    if (!connected || !token) return undefined;
    let cancelled = false;
    (async () => {
      const res = await api("GET", "/api/random/messages", token);
      if (cancelled) return;
      if (res.status === 401) {
        expire();
      } else if (res.ok) {
        setSession(res.data.session);
        setMessages(res.data.messages || []);
        setPhase("chat");
      } else if (res.status === 404 && phaseRef.current === "searching") {
        search();
      }
    })();
    return () => { cancelled = true; };
  }, [connected, token, expire, search]);

  const start = async () => {
    const next = {
      ...form,
      seek_age_min: clampSeekAge(form.seek_age_min),
      seek_age_max: clampSeekAge(form.seek_age_max),
    };
    if (next.seek_age_min !== form.seek_age_min || next.seek_age_max !== form.seek_age_max) {
      setForm(next);
    }
    const { prefs, error: formError } = validateForm(next);
    if (formError) {
      setError(formError);
      return;
    }
    setStarting(true);
    setError("");
    const res = await api("POST", "/api/random/start", null, {
      ...prefs,
      anon_id: getAnonId(),
    });
    setStarting(false);
    if (!res.ok) {
      const messages = {
        "invalid prefs": "Перевірте введені дані",
        "too many requests": "Забагато спроб, спробуйте пізніше",
      };
      setError(messages[res.data.error] || "Не вдалося почати, спробуйте ще раз");
      return;
    }
    saveAnonId(res.data.anon_id);
    sessionStorage.setItem(RANDOM_TOKEN_KEY, res.data.token);
    sessionStorage.setItem(RANDOM_PREFS_KEY, JSON.stringify(res.data.prefs));
    setPhase("searching");
    setToken(res.data.token);
  };

  const leave = async () => {
    if (token) await api("POST", "/api/random/skip", token);
    resetToForm();
  };

  const next = async () => {
    setConfirmNext(false);
    await api("POST", "/api/random/skip", token);
    search();
  };

  const cancelReply = () => setReplyTo(null);

  const startReply = (msg) => {
    if (!msg || typeof msg.id !== "number" || msg.mine) return;
    setReplyTo({
      id: msg.id,
      from: genderLabel(msg.from_gender),
      text: msg.text || "",
    });
    inputRef.current?.focus();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || phase !== "chat") return;
    const replyTarget = replyTo;
    setInput("");
    setReplyTo(null);
    setEmojiOpen(false);
    const res = await api("POST", "/api/random/messages", token, {
      text,
      ...(replyTarget ? { reply_to: replyTarget.id } : {}),
    });
    if (res.ok) {
      setMessages((prev) => (prev.some((m) => m.id === res.data.id) ? prev : [...prev, { ...res.data, isNew: true }]));
      return;
    }
    setInput(text);
    if (replyTarget) setReplyTo(replyTarget);
    if (res.status === 401) expire();
    else if (res.status === 409) setPhase("peerLeft");
  };

  const insertEmoji = (emoji) => {
    setInput((v) => (v + emoji).slice(0, MAX_MESSAGE_LEN));
    inputRef.current?.focus();
  };

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setSeekAge = (key) => (e) => setField(key)(e.target.value);
  const clampSeekField = (key) => () => setForm((f) => ({ ...f, [key]: clampSeekAge(f[key]) }));
  const onFormKey = (e) => { if (e.key === "Enter") start(); };

  const card = {
    background: NEU_BG,
    borderRadius: isPhone ? 0 : 28,
    boxShadow: isPhone ? "none" : `9px 9px 18px ${SHADOW_D}, -9px -9px 18px ${SHADOW_L}`,
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: isPhone ? "100%" : (isDesktop ? "min(760px, 100%)" : 380),
    height: isPhone ? "100dvh" : (isDesktop ? "min(860px, calc(100dvh - 48px))" : 620),
  };

  const accountButton = (
    <button
      className="neu-press-soft"
      onClick={onOpenAccount}
      style={{
        marginLeft: "auto",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontFamily: "'Nunito', sans-serif",
        fontSize: 12,
        fontWeight: 700,
        color: "#c084a0",
        flexShrink: 0,
      }}
    >
      {hasAccount ? "Мої чати →" : "Увійти →"}
    </button>
  );

  const brandHeader = (
    <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div><BooblifyLogo /></div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af" }}>Інкогніто</div>
      </div>
      {accountButton}
    </div>
  );

  const formView = (
    <div style={{
      flex: 1,
      overflowY: "auto",
      padding: "8px 20px 24px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#4b5563", textAlign: "center", margin: "8px 0 2px" }}>
          Вільний чат
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Я</label>
          <Chips options={MY_GENDER_OPTIONS} value={form.gender} onChange={setField("gender")} />
          <label style={labelStyle}>Мій вік</label>
          <Chips options={AGE_BANDS} value={form.age_band} onChange={setField("age_band")} />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Шукаю</label>
          <Chips options={SEEK_GENDER_OPTIONS} value={form.seek_gender} onChange={setField("seek_gender")} />
          <label style={labelStyle}>Вік співрозмовника</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <NeuField
                type="number"
                value={form.seek_age_min}
                onChange={setSeekAge("seek_age_min")}
                onBlur={clampSeekField("seek_age_min")}
                onKey={onFormKey}
                min={MIN_AGE}
                max={MAX_AGE}
                placeholder="від"
              />
            </div>
            <span style={{ fontWeight: 800, color: "#9ca3af" }}>—</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <NeuField
                type="number"
                value={form.seek_age_max}
                onChange={setSeekAge("seek_age_max")}
                onBlur={clampSeekField("seek_age_max")}
                onKey={onFormKey}
                min={MIN_AGE}
                max={MAX_AGE}
                placeholder="до"
              />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center", marginTop: 4 }}>{error}</div>
        )}

        <PillButton primary onClick={start} disabled={starting} style={{ width: "100%", marginTop: 8 }}>
          {starting ? "Починаємо..." : "Знайти співрозмовника"}
        </PillButton>
      </div>
    </div>
  );

  const searchingView = (
    <div style={{
      flex: 1,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 16, padding: 24, textAlign: "center",
    }}>
      <div className="profile-hint-pulse" style={{
        width: 84, height: 84, borderRadius: "50%",
        background: NEU_BG,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span className="booblify-letter" style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }} aria-hidden="true">B</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#4b5563" }}>
        {connected ? "Шукаємо співрозмовника..." : "Підключення..."}
      </div>
      {error && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0" }}>{error}</div>
      )}
      <PillButton onClick={leave}>Скасувати</PillButton>
    </div>
  );

  const chatHeader = session && (
    <div style={{
      padding: "18px 20px",
      display: "flex", alignItems: "center", gap: 12,
      borderBottom: isDesktop ? `1px solid ${PANE_DIVIDER}` : "none",
    }}>
      <Avatar initials={genderSign(session.peer_gender)} color={onlineColor(session.peer_gender)} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#4b5563" }}>{peerNick(session)}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: phase === "peerLeft" ? "#9ca3af" : onlineColor(session.peer_gender) }}>
          {phase === "peerLeft"
            ? (session.peer_gender === "female" ? "Вийшла з чату" : "Вийшов з чату")
            : "● онлайн"}
        </div>
      </div>
      {phase === "chat" && (
        <PillButton primary onClick={() => setConfirmNext(true)} style={{ marginLeft: "auto", padding: "9px 16px", fontSize: 13 }}>
          Далі →
        </PillButton>
      )}
      <button
        className="neu-press"
        onClick={leave}
        title="Завершити і змінити пошук"
        style={{
          marginLeft: phase === "chat" ? 0 : "auto",
          width: 36, height: 36, borderRadius: "50%",
          border: "none", background: NEU_BG,
          boxShadow: neu(false, 3, 6),
          cursor: "pointer",
          fontSize: 13, fontWeight: 800, color: "#9ca3af",
          flexShrink: 0,
        }}
      >✕</button>
    </div>
  );

  const composer = (
    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      {replyTo && (
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
          maxHeight: 196,
          overflowY: "auto",
          padding: 8,
          borderRadius: 18,
          background: NEU_BG,
          boxShadow: neu(false, 5, 12),
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
          gap: 2,
          justifyItems: "center",
        }}>
          {EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              className="neu-press-soft"
              onClick={() => insertEmoji(em)}
              style={{
                border: "none", background: "transparent", cursor: "pointer",
                fontSize: 20, lineHeight: 1, width: "100%", maxWidth: 40, aspectRatio: "1",
                padding: 0, borderRadius: 10,
              }}
            >
              {em}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          background: NEU_BG, borderRadius: 50,
          boxShadow: neu(true, 4, 8), padding: "0 16px",
          minWidth: 0,
        }}>
          <input
            ref={inputRef}
            value={input}
            maxLength={MAX_MESSAGE_LEN}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && replyTo) {
                e.preventDefault();
                cancelReply();
                return;
              }
              if (e.key === "Enter") send();
            }}
            placeholder={replyTo ? "Написати відповідь..." : "Написати повідомлення..."}
            style={{
              flex: 1, border: "none", outline: "none",
              background: "transparent",
              fontFamily: "'Nunito', sans-serif",
              fontSize: 13, fontWeight: 600,
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
          aria-label="Надіслати"
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
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );

  const peerLeftBar = (
    <div style={{
      padding: "16px 20px 20px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
      animation: "fadeUp 0.25s ease both",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af" }}>Співрозмовник вийшов з чату</div>
      <div style={{ display: "flex", gap: 10 }}>
        <PillButton primary onClick={search}>Шукати далі →</PillButton>
        <PillButton onClick={leave}>Змінити</PillButton>
      </div>
    </div>
  );

  const chatView = session && (
    <>
      {chatHeader}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column" }}>
        {messages.length === 0 && phase === "chat" && (
          <div style={{
            alignSelf: "center",
            marginBottom: 18,
            padding: "4px 14px",
            borderRadius: 50,
            boxShadow: neu(true, 2, 5),
            fontSize: 11, fontWeight: 700, color: "#9ca3af",
          }}>
            Привітайтесь першими 👋
          </div>
        )}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            msg={m}
            mine={m.mine}
            palette={GENDER_BUBBLE[m.from_gender]}
            initials={genderSign(m.from_gender)}
            animate={Boolean(m.isNew)}
            onReply={phase === "chat" ? startReply : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      {phase === "peerLeft" ? peerLeftBar : composer}
    </>
  );

  let body = formView;
  if (phase === "searching") body = searchingView;
  else if ((phase === "chat" || phase === "peerLeft") && session) body = chatView;

  const confirmNextModal = confirmNext && (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 100,
      background: "rgba(75, 85, 99, 0.25)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-next-title"
        style={{
          width: "100%",
          maxWidth: 320,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: "24px 22px",
          borderRadius: 24,
          background: NEU_BG,
          boxShadow: `9px 9px 18px ${SHADOW_D}, -9px -9px 18px ${SHADOW_L}`,
          fontFamily: "'Nunito', sans-serif",
          animation: "fadeUp 0.2s ease both",
        }}
      >
        <div id="confirm-next-title" style={{ fontSize: 16, fontWeight: 800, color: "#4b5563", textAlign: "center" }}>
          Завершити цей чат?
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", textAlign: "center", lineHeight: 1.45 }}>
          Поточну розмову буде завершено, і ми пошукаємо нового співрозмовника.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <PillButton onClick={() => setConfirmNext(false)} style={{ flex: 1 }}>
            Скасувати
          </PillButton>
          <PillButton primary onClick={next} style={{ flex: 1 }}>
            Так, далі
          </PillButton>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <AppStyles />
      <div style={{
        minHeight: "100dvh",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: NEU_BG,
        fontFamily: "'Nunito', sans-serif",
        padding: isDesktop ? 24 : 0,
      }}>
        <div style={card}>
          {phase === "form" || phase === "searching" ? brandHeader : null}
          {body}
        </div>
      </div>
      {confirmNextModal}
    </>
  );
}