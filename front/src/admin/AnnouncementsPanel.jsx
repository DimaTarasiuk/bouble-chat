import { useEffect, useState } from "react";
import { API_URL, authHeaders, formatDateTime, NEU_BG, neu } from "../shared.js";

const MAX_LEN = 2000;

export default function AnnouncementsPanel() {
  const [text, setText] = useState("");
  const [list, setList] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/admin/announcements`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setList(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    if (!window.confirm("Надіслати оголошення всім користувачам?")) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`${API_URL}/api/admin/announcements`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("Не вдалося надіслати");
        return;
      }
      setList((prev) => [data, ...prev]);
      setText("");
      setNotice("Надіслано");
    } catch {
      setError("Не вдалося надіслати");
    } finally {
      setSending(false);
    }
  };

  const tooLong = text.length > MAX_LEN;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
      <div style={{ borderRadius: 18, background: NEU_BG, boxShadow: neu(true, 4, 8), padding: "12px 16px" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Текст оголошення для всіх користувачів..."
          rows={4}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            resize: "vertical",
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

      <button
        type="button"
        className="neu-press"
        onClick={send}
        disabled={sending || !text.trim() || tooLong}
        style={{
          padding: "12px 0",
          border: "none",
          borderRadius: 50,
          background: NEU_BG,
          boxShadow: neu(false, 4, 8),
          cursor: sending ? "default" : "pointer",
          opacity: sending || !text.trim() || tooLong ? 0.6 : 1,
          fontFamily: "'Nunito', sans-serif",
          fontSize: 14,
          fontWeight: 800,
          color: "#6b8fb5",
        }}
      >
        {sending ? "Надсилання..." : "Надіслати всім →"}
      </button>

      {notice && <div style={{ fontSize: 12, fontWeight: 700, color: "#6b8fb5", textAlign: "center" }}>{notice}</div>}
      {error && <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center" }}>{error}</div>}

      <div style={{ fontSize: 12, fontWeight: 800, color: "#6b8fb5", padding: "4px 4px 0" }}>Історія</div>
      {list.length === 0 ? (
        <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textAlign: "center", padding: "8px 0" }}>
          Ще не було оголошень
        </div>
      ) : list.map((a) => (
        <div key={a.id} style={{ borderRadius: 16, background: NEU_BG, boxShadow: neu(false, 3, 6), padding: "10px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 4 }}>
            {formatDateTime(a.created_at)}{a.created_by ? ` · ${a.created_by}` : ""}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#4b5563", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {a.text}
          </div>
        </div>
      ))}
    </div>
  );
}
