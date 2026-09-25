import { useState } from "react";
import { NEU_BG, neu } from "./shared.js";

export function Avatar({ initials, color }) {
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

export function NeuField({ type = "text", value, onChange, placeholder, onKey, autoFocus }) {
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
          minWidth: 0,
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
