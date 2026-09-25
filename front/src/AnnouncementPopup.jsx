import { formatDateTime, NEU_BG, neu, SHADOW_D, SHADOW_L } from "./shared.js";

export default function AnnouncementPopup({ queue, onAck }) {
  if (!queue.length) return null;
  const current = queue[0];
  const rest = queue.length - 1;

  return (
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
        key={current.id}
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth: 340,
          maxHeight: "80vh",
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#4b5563" }}>Оголошення</span>
          {rest > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>ще {rest}</span>
          )}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>
          {formatDateTime(current.created_at)}
        </div>
        <div style={{
          overflowY: "auto",
          fontSize: 14,
          fontWeight: 600,
          color: "#4b5563",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {current.text}
        </div>
        <button
          type="button"
          className="neu-press"
          onClick={() => onAck(current.id)}
          style={{
            padding: "12px 0",
            border: "none",
            borderRadius: 50,
            background: NEU_BG,
            boxShadow: neu(false, 4, 8),
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
            fontSize: 14,
            fontWeight: 800,
            color: "#6b8fb5",
          }}
        >
          {rest > 0 ? "Далі →" : "Ок"}
        </button>
      </div>
    </div>
  );
}
