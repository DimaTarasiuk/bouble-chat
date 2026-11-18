import { useCallback, useEffect, useRef, useState } from "react";
import {
  API_URL,
  authHeaders,
  formatDateTime,
  GENDER_BUBBLE,
  NEU_BG,
  neu,
  onlineColor,
} from "../shared.js";
import { Avatar, Bubble } from "../ui.jsx";

const POLL_MS = 3000;
const genderSign = (g) => (g === "female" ? "♀" : "♂");
const guestTitle = (g) => `${genderSign(g.gender)} ${g.age}`;

export default function RandomMonitor({ wide = false }) {
  const [status, setStatus] = useState("active");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const bottomRef = useRef(null);
  const selectedIdRef = useRef(null);

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/admin/random/sessions?status=${encodeURIComponent(status)}&limit=50`,
        { headers: authHeaders() },
      );
      const data = await res.json().catch(() => ([]));
      if (!res.ok) {
        setError(data.error === "forbidden"
          ? "Доступ лише для head"
          : (data.error || `Не вдалося завантажити (${res.status})`));
        return;
      }
      setError("");
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setError("Не вдалося завантажити");
    } finally {
      setLoading(false);
    }
  }, [status]);

  const loadDetail = useCallback(async (id, soft = false) => {
    if (!id) return;
    if (!soft) setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/random/sessions/${id}`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!soft) setError(data.error || "Чат не знайдено");
        return;
      }
      if (selectedIdRef.current !== id) return;
      setDetail(data);
      setSessions((prev) => prev.map((s) => (s.id === data.session.id ? data.session : s)));
    } catch {
      if (!soft) setError("Не вдалося відкрити чат");
    } finally {
      if (!soft) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelectedId(null);
    setDetail(null);
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const t = setInterval(loadSessions, POLL_MS * 2);
    return () => clearInterval(t);
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedId) return undefined;
    loadDetail(selectedId);
    const t = setInterval(() => loadDetail(selectedId, true), POLL_MS);
    return () => clearInterval(t);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [detail?.messages?.length, selectedId]);

  const openSession = (id) => {
    setSelectedId(id);
    setDetail(null);
  };

  const tabs = [
    { id: "active", label: "Активні" },
    { id: "ended", label: "Завершені" },
    { id: "all", label: "Усі" },
  ];

  const listPane = (
    <div style={{
      display: "flex", flexDirection: "column", gap: 10,
      height: wide ? "100%" : undefined,
      minHeight: 0,
      ...(wide ? { width: 320, flexShrink: 0, borderRight: "1px solid rgba(163,177,198,0.35)" } : {}),
    }}>
      <div style={{ display: "flex", gap: 6, padding: wide ? "12px 12px 0" : 0 }}>
        {tabs.map((tab) => {
          const active = status === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className="neu-press"
              onClick={() => setStatus(tab.id)}
              style={{
                flex: 1, padding: "9px 0", border: "none", borderRadius: 50,
                background: NEU_BG,
                boxShadow: active ? neu(true, 3, 6) : neu(false, 3, 6),
                cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
                fontSize: 11, fontWeight: 800,
                color: active ? "#6b8fb5" : "#9ca3af",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center", padding: "0 8px" }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: wide ? "8px 12px 12px" : "4px 0 0", minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 24 }}>
            Завантаження...
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 24 }}>
            Немає чатів
          </div>
        ) : sessions.map((s) => {
          const active = selectedId === s.id;
          const isLive = s.status === "active";
          return (
            <button
              key={s.id}
              type="button"
              className="neu-press"
              onClick={() => openSession(s.id)}
              style={{
                width: "100%",
                display: "flex", flexDirection: "column", gap: 4,
                padding: "10px 12px", marginBottom: 8,
                border: "none", borderRadius: 16,
                background: NEU_BG,
                boxShadow: active ? neu(true, 3, 6) : neu(false, 3, 6),
                cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#4b5563" }}>
                  #{s.id} · {guestTitle(s.guest_a)} × {guestTitle(s.guest_b)}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 800, flexShrink: 0,
                  color: isLive ? onlineColor("male") : "#9ca3af",
                }}>
                  {isLive ? "● live" : "ended"}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>
                {formatDateTime(s.last_message_at || s.created_at)} · {s.message_count} пов.
              </div>
              {s.last_text && (
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "#6b7280",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {s.last_text}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const chatPane = selectedId && (
    <div style={{
      flex: 1, minWidth: 0, minHeight: 0,
      display: "flex", flexDirection: "column",
      ...(wide ? {} : { marginTop: 12 }),
    }}>
      {detailLoading && !detail ? (
        <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 24 }}>
          Завантаження чату...
        </div>
      ) : detail ? (
        <>
          <div style={{
            padding: wide ? "14px 16px" : "10px 4px",
            display: "flex", alignItems: "center", gap: 10,
            borderBottom: wide ? "1px solid rgba(163,177,198,0.35)" : "none",
          }}>
            {!wide && (
              <button
                type="button"
                className="neu-press-soft"
                onClick={() => { setSelectedId(null); setDetail(null); }}
                style={{
                  border: "none", background: "transparent", cursor: "pointer",
                  fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700, color: "#9ca3af",
                }}
              >←</button>
            )}
            <Avatar
              initials={genderSign(detail.session.guest_a.gender)}
              color={onlineColor(detail.session.guest_a.gender)}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#4b5563" }}>
                #{detail.session.id} · {guestTitle(detail.session.guest_a)} × {guestTitle(detail.session.guest_b)}
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700,
                color: detail.session.status === "active" ? onlineColor("male") : "#9ca3af",
              }}>
                {detail.session.status === "active" ? "● Активний чат · лише перегляд" : "Завершений · лише перегляд"}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", minHeight: wide ? 0 : 280 }}>
            {(detail.messages || []).length === 0 ? (
              <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "#9ca3af", marginTop: 20 }}>
                Повідомлень ще немає
              </div>
            ) : (detail.messages || []).map((m) => (
              <Bubble
                key={m.id}
                msg={m}
                mine={m.from_guest === detail.session.guest_a.id}
                palette={GENDER_BUBBLE[m.from_gender]}
                initials={genderSign(m.from_gender)}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        </>
      ) : null}
    </div>
  );

  if (wide) {
    return (
      <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
        {listPane}
        {selectedId ? chatPane : (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 600, color: "#9ca3af", padding: 24, textAlign: "center",
          }}>
            Оберіть random-чат зі списку
          </div>
        )}
      </div>
    );
  }

  if (selectedId) return chatPane;
  return listPane;
}
