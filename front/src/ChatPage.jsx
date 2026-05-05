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

function Bubble({ msg }) {
  const isMe = msg.from === "me";
  return (
    <div style={{
      display: "flex",
      flexDirection: isMe ? "row-reverse" : "row",
      alignItems: "flex-end",
      gap: 10,
      marginBottom: 16,
      animation: "fadeUp 0.25s ease both",
    }}>
      {!isMe && <Avatar initials="SB" color="#c084a0" />}

      <div style={{ maxWidth: "68%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
        <div style={{
          padding: "11px 16px",
          borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isMe
            ? "#ffffff"
            : "#f5e8ee",
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

      {isMe && <Avatar initials="ME" color="#6b8fb5" />}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [btnActive, setBtnActive] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
  fetch("http://localhost:7979/api/messages")
    .then(res => res.json())
    .then(data => setMessages(data))
  }, []);

  useEffect(() => {
  const ws = new WebSocket("ws://localhost:7979/ws");
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    setMessages(prev => [...prev, msg]);
  };
  return () => ws.close();
}, []);

  const now = () => {
    const d = new Date();
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const send = () => {
  const text = input.trim();
  if (!text) return;
  
  fetch("http://localhost:7979/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "me", text })
  })
    .then(res => res.json())
  
  setInput("");
};

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

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

          {/* ── Header ── */}
          <div style={{
            padding: "18px 20px",
            display: "flex", alignItems: "center", gap: 12,
            borderBottom: "none",
          }}>
            {/* Avatar with online dot */}
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
              <div style={{ fontSize: 15, fontWeight: 800, color: "#4b5563" }}>share<span style={{ color: "#868e99" }}>bite</span> Support</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#86efac" }}>● Online</div>
            </div>

            {/* Menu dots */}
            <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: SHADOW_D,
                }}/>
              ))}
            </div>
          </div>

          {/* ── Messages ── */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 18px",
            display: "flex", flexDirection: "column",
          }}>
            {/* Date badge */}
            <div style={{
              textAlign: "center",
              fontSize: 11, fontWeight: 700, color: "#9ca3af",
              marginBottom: 18,
              background: NEU_BG,
              display: "inline-block",
              alignSelf: "center",
              padding: "4px 14px",
              borderRadius: 50,
              boxShadow: neu(true, 2, 5),
            }}>
              Сьогодні
            </div>

            {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
            <div ref={bottomRef} />
          </div>

          {/* ── Input row ── */}
          <div style={{
            padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              flex: 1,
              display: "flex", alignItems: "center",
              background: NEU_BG,
              borderRadius: 50,
              boxShadow: neu(true, 4, 8),
              padding: "0 16px",
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Написати повідомлення..."
                style={{
                  flex: 1,
                  border: "none", outline: "none",
                  background: "transparent",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 13, fontWeight: 600,
                  color: "#4b5563",
                  padding: "13px 0",
                }}
              />
              {/* Emoji btn */}
              <button style={{
                border: "none", background: "transparent",
                cursor: "pointer", fontSize: 17, padding: "0 0 0 8px",
                color: "#9ca3af",
              }}>😊</button>
            </div>

            {/* Send button */}
            <button
              onClick={send}
              onMouseDown={() => setBtnActive(true)}
              onMouseUp={() => setBtnActive(false)}
              onMouseLeave={() => setBtnActive(false)}
              style={{
                width: 46, height: 46,
                borderRadius: "50%",
                border: "none",
                background: "#868e99",
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
