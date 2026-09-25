import { useEffect, useState } from "react";
import {
  API_URL,
  authHeaders,
  formatDateTime,
  NEU_BG,
  neu,
  onlineColor,
  ONLINE_OFF_TEXT,
} from "../shared.js";
import { Avatar, NeuField } from "../ui.jsx";

const GENDER_LABELS = { male: "Чол", female: "Жін" };

const ERROR_TEXT = {
  "user not found": "Користувача не знайдено",
  "cannot moderate this user": "Цього користувача не можна модерувати",
};

function formatBirth(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 4px" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#4b5563", textAlign: "right", wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, color = "#6b8fb5" }) {
  return (
    <button
      type="button"
      className="neu-press"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: "12px 0",
        border: "none",
        borderRadius: 50,
        background: NEU_BG,
        boxShadow: neu(false, 3, 6),
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: "'Nunito', sans-serif",
        fontSize: 13,
        fontWeight: 800,
        color,
      }}
    >
      {children}
    </button>
  );
}

export default function UserCard({ username, online, onClose, onOpenChat, onChanged }) {
  const [card, setCard] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [banMode, setBanMode] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/admin/users/${encodeURIComponent(username)}`, { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(ERROR_TEXT[data.error] || "Не вдалося завантажити картку");
          return;
        }
        setCard(data);
      })
      .catch(() => {
        if (!cancelled) setError("Не вдалося завантажити картку");
      });
    return () => { cancelled = true; };
  }, [username]);

  const act = async (action, body) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `${API_URL}/api/admin/users/${encodeURIComponent(username)}/${action}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: body ? JSON.stringify(body) : undefined,
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERROR_TEXT[data.error] || "Дію не виконано");
        return;
      }
      if (action === "kick") {
        setNotice("Користувача відключено");
        setCard((c) => (c ? { ...c, online: false } : c));
      } else {
        setCard((c) => (c ? { ...c, ...data, online: action === "ban" ? false : c.online } : c));
        setNotice(action === "ban" ? "Користувача заблоковано" : "Користувача розблоковано");
        setBanMode(false);
        setReason("");
      }
      onChanged?.();
    } catch {
      setError("Дію не виконано");
    } finally {
      setBusy(false);
    }
  };

  const kick = () => {
    if (window.confirm(`Відключити ${username}? Йому доведеться увійти знову.`)) act("kick");
  };

  const ban = () => {
    if (window.confirm(`Заблокувати ${username}?`)) act("ban", { reason: reason.trim() });
  };

  const isOnline = card ? (card.online || online) : online;
  const banned = !!card?.banned_at;
  const canModerate = card && card.role !== "head";
  const fullName = card ? [card.first_name, card.last_name].filter(Boolean).join(" ") : "";

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
          onClick={onClose}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "none", background: NEU_BG,
            boxShadow: neu(false, 4, 8),
            cursor: "pointer",
            fontSize: 18, fontWeight: 800, color: "#6b8fb5",
          }}
        >←</button>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#4b5563" }}>Картка юзера</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {!card && !error && (
          <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#9ca3af", marginTop: 24 }}>
            Завантаження...
          </div>
        )}

        {card && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar initials={card.username.slice(0, 2).toUpperCase()} color="#6b8fb5" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#4b5563" }}>
                  {card.username}
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}> · {card.role}</span>
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 700,
                  color: banned ? "#c084a0" : (isOnline ? onlineColor(card.gender) : ONLINE_OFF_TEXT),
                }}>
                  {banned ? "Заблокований" : (isOnline ? "● Online" : "Offline")}
                </div>
              </div>
            </div>

            <div style={{ borderRadius: 18, boxShadow: neu(true, 3, 6), padding: "6px 12px" }}>
              <Row label="Імʼя" value={fullName || "—"} />
              <Row label="Стать" value={GENDER_LABELS[card.gender] || "—"} />
              <Row label="Дата народження" value={formatBirth(card.birth_date)} />
              <Row label="Зареєстрований" value={formatDateTime(card.created_at, "—")} />
              <Row label="Останній візит" value={isOnline ? "зараз" : formatDateTime(card.last_seen, "ще не заходив")} />
              <Row label="Чатів" value={card.chats_count} />
              <Row label="Повідомлень" value={card.messages_count} />
              {banned && (
                <>
                  <Row label="Заблоковано" value={formatDateTime(card.banned_at, "—")} />
                  <Row label="Причина" value={card.ban_reason || "—"} />
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <ActionButton onClick={() => onOpenChat(card.username)} disabled={busy}>Написати</ActionButton>
              {canModerate && (
                <ActionButton onClick={kick} disabled={busy || banned} color="#c084a0">Кік</ActionButton>
              )}
            </div>

            {canModerate && (
              banned ? (
                <ActionButton onClick={() => act("unban")} disabled={busy}>Розбанити</ActionButton>
              ) : banMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <NeuField
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Причина бану (необовʼязково)"
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <ActionButton onClick={() => { setBanMode(false); setReason(""); }} disabled={busy} color="#9ca3af">
                      Скасувати
                    </ActionButton>
                    <ActionButton onClick={ban} disabled={busy} color="#c084a0">Забанити</ActionButton>
                  </div>
                </div>
              ) : (
                <ActionButton onClick={() => setBanMode(true)} disabled={busy} color="#c084a0">Забанити</ActionButton>
              )
            )}
          </>
        )}

        {notice && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6b8fb5", textAlign: "center" }}>{notice}</div>
        )}
        {error && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center" }}>{error}</div>
        )}
      </div>
    </div>
  );
}
