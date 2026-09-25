import { useState } from "react";
import { API_URL, authHeaders, NEU_BG, neu, SHADOW_D, SHADOW_L } from "./shared.js";

const MAX_LEN = 2000;

export default function FeedbackForm({ onClose }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const tooLong = text.length > MAX_LEN;
  const disabled = sending || !text.trim() || tooLong;

  const send = async () => {
    if (disabled) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) {
        setError(res.status === 429 ? "Забагато відгуків, спробуйте пізніше" : "Не вдалося надіслати");
        return;
      }
      setSent(true);
    } catch {
      setError("Не вдалося надіслати");
    } finally {
      setSending(false);
    }
  };

  const buttonStyle = (color, off) => ({
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
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(75, 85, 99, 0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
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
          animation: "fadeUp 0.2s ease both",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, color: "#4b5563" }}>Фідбек</span>

        {sent ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#4b5563", lineHeight: 1.5 }}>
              Дякуємо! Ваш відгук надіслано.
            </div>
            <button type="button" className="neu-press" onClick={onClose} style={buttonStyle("#6b8fb5", false)}>
              Ок
            </button>
          </>
        ) : (
          <>
            <div style={{ borderRadius: 18, background: NEU_BG, boxShadow: neu(true, 4, 8), padding: "12px 16px" }}>
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Що покращити, що не працює, ідеї..."
                rows={5}
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  background: "transparent",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#4b5563",
                  lineHeight: 1.5,
                }}
              />
              <div style={{ textAlign: "right", fontSize: 11, fontWeight: 700, color: tooLong ? "#c084a0" : "#9ca3af" }}>
                {text.length}/{MAX_LEN}
              </div>
            </div>
            {error && <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center" }}>{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="neu-press" onClick={onClose} style={buttonStyle("#9ca3af", false)}>
                Скасувати
              </button>
              <button type="button" className="neu-press" onClick={send} disabled={disabled} style={buttonStyle("#6b8fb5", disabled)}>
                {sending ? "..." : "Надіслати"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
