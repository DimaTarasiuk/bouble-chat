import { useState, useRef, useEffect } from "react";

const NEU_BG = "#e0e5ec";
const SHADOW_D = "#b8bec7";
const SHADOW_L = "#ffffff";

const neu = (inset = false, d = 5, b = 10) => {
  const p = inset ? "inset " : "";
  return `${p}${d}px ${d}px ${b}px ${SHADOW_D}, ${p}-${d}px -${d}px ${b}px ${SHADOW_L}`;
};

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

function Bubble({ msg, username }) {
  const isMe = msg.from === username;
  const initials = msg.from.slice(0, 2).toUpperCase();

  return (
    <div style={{
      display: "flex",
      flexDirection: isMe ? "row-reverse" : "row",
      alignItems: "flex-end",
      gap: 10,
      marginBottom: 16,
      animation: "fadeUp 0.25s ease both",
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

function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [btnActive, setBtnActive] = useState(false);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onLogin(trimmed);
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
      <div style={{
        width: 320,
        background: NEU_BG,
        borderRadius: 28,
        boxShadow: `9px 9px 18px ${SHADOW_D}, -9px -9px 18px ${SHADOW_L}`,
        padding: "40px 32px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
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
          <div style={{ fontSize: 18, fontWeight: 800, color: "#4b5563" }}>Вітаємо!</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 4 }}>
            Введіть ваше ім'я щоб почати чат
          </div>
        </div>

        <div style={{
          width: "100%",
          display: "flex", alignItems: "center",
          background: NEU_BG,
          borderRadius: 50,
          boxShadow: neu(true, 4, 8),
          padding: "0 20px",
        }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ваше ім'я..."
            autoFocus
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
        </div>

        <button
          onClick={handleSubmit}
          onMouseDown={() => setBtnActive(true)}
          onMouseUp={() => setBtnActive(false)}
          onMouseLeave={() => setBtnActive(false)}
          style={{
            width: "100%",
            padding: "13px 0",
            borderRadius: 50,
            border: "none",
            background: NEU_BG,
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
            fontSize: 14, fontWeight: 800,
            color: "#6b8fb5",
            boxShadow: btnActive ? neu(true, 4, 8) : neu(false, 4, 8),
            transform: btnActive ? "scale(0.98)" : "scale(1)",
            transition: "all 0.15s",
          }}
        >
          Увійти в чат →
        </button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [username, setUsername] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [btnActive, setBtnActive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef(null);
  const notificationSound = useRef(new Audio("src/static/bulk-10.mp3"));

  useEffect(() => {
    if (!loaded) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loaded]);

  useEffect(() => {
    if (!username) return;

    fetch("http://localhost:7979/api/messages")
      .then(res => res.json())
      .then(data => {
        setMessages(data);
        setLoaded(true);
      });

    const ws = new WebSocket("ws://localhost:7979/ws");

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
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
          notificationSound.current.currentTime = 0;
          notificationSound.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    return () => ws.close();
  }, [username]);

  const send = async () => {
    const text = input.trim();
    if (!text || !username) return;

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
      const res = await fetch("http://localhost:7979/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: username, text })
      });
      const savedMsg = await res.json();
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

  if (!username) {
    return <LoginScreen onLogin={setUsername} />;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${NEU_BG}; }
        ::-webkit-scrollbar { width: 0; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

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
                background: "#86efac",
                boxShadow: `0 0 0 2px ${NEU_BG}`,
              }}/>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#4b5563" }}>
                <span style={{ color: "#868e99" }}>Bouble</span> Chat
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#86efac" }}>● Online</div>
            </div>
            <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#9ca3af" }}>
              {username}
            </div>
          </div>

          {/* Messages */}
          <div style={{
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

            {messages.map(msg => <Bubble key={msg.id} msg={msg} username={username} />)}
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
              <button style={{
                border: "none", background: "transparent",
                cursor: "pointer", fontSize: 17, padding: "0 0 0 8px", color: "#9ca3af",
              }}>😊</button>
            </div>

            {/* кнопка відправки — повернули стилі і іконку */}
            <button
              onClick={send}
              onMouseDown={() => setBtnActive(true)}
              onMouseUp={() => setBtnActive(false)}
              onMouseLeave={() => setBtnActive(false)}
              style={{
                width: 46, height: 46, borderRadius: "50%",
                border: "none", background: "#868e99",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: btnActive
                  ? `inset 3px 3px 6px #6e7580, inset -3px -3px 6px #9ea8b3`
                  : neu(false, 4, 8),
                transform: btnActive ? "scale(0.95)" : "scale(1)",
                transition: "all 0.15s",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    </>
  );
}