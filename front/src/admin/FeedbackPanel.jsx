import { useEffect, useRef, useState } from "react";
import { API_URL, authHeaders, formatDateTime, NEU_BG, neu } from "../shared.js";

export default function FeedbackPanel({ reloadKey = 0, onSeen }) {
  const [list, setList] = useState(null);
  const onSeenRef = useRef(onSeen);

  useEffect(() => {
    onSeenRef.current = onSeen;
  }, [onSeen]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/admin/feedback`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : [];
        setList(items);
        onSeenRef.current?.(items[0]?.id || 0);
      })
      .catch(() => {
        if (!cancelled) setList((prev) => prev ?? []);
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (list === null) {
    return <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textAlign: "center", paddingTop: 24 }}>Завантаження...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#6b8fb5", padding: "4px 4px 0" }}>
        Фідбеки · {list.length}
      </div>
      {list.length === 0 ? (
        <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textAlign: "center", padding: "8px 0" }}>
          Поки що фідбеків немає
        </div>
      ) : list.map((f) => (
        <div key={f.id} style={{ borderRadius: 16, background: NEU_BG, boxShadow: neu(false, 3, 6), padding: "10px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 4 }}>
            {formatDateTime(f.created_at)} · {f.username || "видалений юзер"}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#4b5563", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {f.text}
          </div>
        </div>
      ))}
    </div>
  );
}
