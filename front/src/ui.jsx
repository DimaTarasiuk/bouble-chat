import { useState, useRef, useEffect } from "react";
import {
  NEU_BG,
  SHADOW_D,
  SHADOW_L,
  NAME_ABBR,
  DESKTOP_QUERY,
  neu,
  haptic,
  canEditMessage,
} from "./shared.js";

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

export function NeuField({ type = "text", value, onChange, placeholder, onKey, onBlur, autoFocus, min, max }) {
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
        onBlur={onBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        min={min}
        max={max}
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

export function AppStyles() {
  useEffect(() => {
    const onDown = (e) => {
      const el = e.target.closest?.(".neu-press, .neu-press-send, .neu-press-soft");
      if (!el) return;
      haptic(el.classList.contains("neu-press-send") ? 20 : 12);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: ${NEU_BG}; }
      input[type=number]::-webkit-outer-spin-button,
      input[type=number]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input[type=number] {
        -moz-appearance: textfield;
        appearance: textfield;
      }
      ::-webkit-scrollbar { width: 0; }
      @media ${DESKTOP_QUERY} {
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(163, 177, 198, 0.55); border-radius: 3px; }
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes profileHintPulse {
        0%, 100% {
          transform: scale(1);
          box-shadow: 4px 4px 8px ${SHADOW_D}, -4px -4px 8px ${SHADOW_L};
        }
        40% {
          transform: scale(1.1);
          box-shadow: 0 0 0 0 rgba(192, 132, 160, 0.45), 4px 4px 8px ${SHADOW_D}, -4px -4px 8px ${SHADOW_L};
        }
        70% {
          transform: scale(1.04);
          box-shadow: 0 0 0 10px rgba(192, 132, 160, 0), 4px 4px 8px ${SHADOW_D}, -4px -4px 8px ${SHADOW_L};
        }
      }
      .profile-hint-pulse {
        animation: profileHintPulse 1.35s ease-in-out infinite;
      }
      @keyframes booblifyShine {
        from { background-position: 0% 50%; }
        to   { background-position: 300% 50%; }
      }
      @keyframes booblifyWave {
        0%, 55%, 100% { transform: translateY(0) scale(1); }
        22% { transform: translateY(-2.5px) scale(1.18); }
        38% { transform: translateY(0.5px) scale(0.97); }
      }
      .booblify-logo {
        display: inline-flex;
        align-items: baseline;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.02em;
        line-height: 1.35;
      }
      .booblify-letter {
        display: inline-block;
        transform-origin: 50% 70%;
        background: linear-gradient(
          100deg,
          #5b7399 0%,
          #6b8fb5 20%,
          #9a8bb8 36%,
          #c084a0 50%,
          #e01b77 60%,
          #ff9ec4 66%,
          #c084a0 76%,
          #6b8fb5 90%,
          #5b7399 100%
        );
        background-size: 300% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 1px 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 1px 2px rgba(107, 143, 181, 0.35));
        animation:
          booblifyShine 4.5s linear infinite,
          booblifyWave 3.2s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .booblify-letter {
          animation: none;
          background-position: 0% 50%;
          transform: none;
        }
      }
      @keyframes badgeIn {
        0%   { transform: scale(0); opacity: 0; }
        60%  { transform: scale(1.3); opacity: 1; }
        80%  { transform: scale(0.92); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes badgePop {
        0%   { transform: scale(1) rotate(0deg); }
        25%  { transform: scale(1.5) rotate(-10deg); }
        45%  { transform: scale(0.88) rotate(7deg); }
        65%  { transform: scale(1.14) rotate(-3deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      @keyframes badgeRing {
        0%   { transform: scale(1); opacity: 0.65; }
        100% { transform: scale(2.3); opacity: 0; }
      }
      @keyframes badgeNum {
        0%   { transform: translateY(70%); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      .unread-badge {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border-radius: 50px;
        color: #fff;
        font-weight: 800;
        animation: badgeIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      .unread-badge.pop {
        animation: badgePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      .unread-badge-ring {
        position: absolute;
        inset: 0;
        border-radius: 50px;
        pointer-events: none;
        opacity: 0;
      }
      .unread-badge.pop .unread-badge-ring {
        animation: badgeRing 0.75s ease-out both;
      }
      .unread-badge-num {
        display: inline-block;
        animation: badgeNum 0.3s ease-out both;
      }
      @media (prefers-reduced-motion: reduce) {
        .unread-badge, .unread-badge.pop, .unread-badge-num,
        .unread-badge.pop .unread-badge-ring {
          animation: none;
        }
      }
      .neu-press {
        transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .neu-press:active {
        transform: scale(0.97);
        box-shadow: inset 3px 3px 6px ${SHADOW_D}, inset -3px -3px 6px ${SHADOW_L} !important;
      }
      .neu-press-send:active {
        transform: scale(0.93);
        box-shadow: inset 3px 3px 6px #6e7580, inset -3px -3px 6px #9ea8b3 !important;
      }
      .neu-press-soft:active {
        transform: scale(0.96);
        opacity: 0.65;
      }
    `}</style>
  );
}

const BOOBLIFY = "Booblify";

export function BooblifyLogo({ size } = {}) {
  return (
    <span
      className="booblify-logo"
      aria-label={BOOBLIFY}
      style={size ? { fontSize: size } : undefined}
    >
      {BOOBLIFY.split("").map((ch, i) => (
        <span
          key={`${ch}${i}`}
          className="booblify-letter"
          style={{ animationDelay: `${-i * 0.18}s, ${i * 0.12}s` }}
          aria-hidden="true"
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

export function Bubble({ msg, username, mine, palette, initials: initialsProp, animate = false, onEdit, onReply }) {
  const isMe = mine ?? msg.from === username;
  const canReply = !isMe && typeof onReply === "function";
  const editable = isMe && typeof onEdit === "function" && canEditMessage(msg, username);
  const initials = initialsProp ?? (msg.from || "?").slice(0, 2).toUpperCase();
  const longPressRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0, dragging: false, replied: false, pointerId: null, active: false });
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragXRef = useRef(0);

  const clearLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const resetDrag = () => {
    startRef.current.dragging = false;
    startRef.current.replied = false;
    startRef.current.active = false;
    startRef.current.pointerId = null;
    dragXRef.current = 0;
    setDragX(0);
    setDragging(false);
  };

  const snapBack = () => {
    startRef.current.dragging = false;
    dragXRef.current = 0;
    setDragX(0);
    setDragging(false);
  };

  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    if (isMe) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      dragging: false,
      replied: false,
      pointerId: e.pointerId,
      active: true,
    };
    dragXRef.current = 0;
    setDragX(0);
    setDragging(false);
    clearLongPress();
    if (editable) {
      longPressRef.current = setTimeout(() => {
        longPressRef.current = null;
        if (startRef.current.dragging || startRef.current.replied) return;
        haptic(18);
        onEdit(msg);
      }, 480);
    }
  };

  const onPointerMove = (e) => {
    const start = startRef.current;
    if (!start.active || start.replied || !canReply) return;
    if (e.pointerType === "mouse" && (e.buttons & 1) !== 1) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!start.dragging) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        clearLongPress();
      }
      if (dx > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        start.dragging = true;
        setDragging(true);
        clearLongPress();
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
        }
      } else {
        return;
      }
    }

    e.preventDefault?.();
    const next = Math.max(0, Math.min(72, dx));
    dragXRef.current = next;
    setDragX(next);
    if (next >= 56 && start.dragging) {
      start.replied = true;
      haptic(16);
      snapBack();
      onReply(msg);
    }
  };

  const onPointerUp = (e) => {
    clearLongPress();
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
    }
    resetDrag();
  };

  const onPointerCancel = () => {
    clearLongPress();
    resetDrag();
  };

  const onLostPointerCapture = () => {
    clearLongPress();
    resetDrag();
  };

  const onContextMenu = (e) => {
    if (editable) e.preventDefault();
  };

  const replyPreview = msg.reply_to;

  return (
    <div style={{
      display: "flex",
      flexDirection: isMe ? "row-reverse" : "row",
      alignItems: "flex-end",
      gap: 10,
      marginBottom: 16,
      position: "relative",
      ...(animate ? { animation: "fadeUp 0.25s ease both" } : {}),
    }}>
      {!isMe && <Avatar initials={initials} color={NAME_ABBR} />}

      <div
        style={{
        maxWidth: "min(68%, 560px)",
        display: "flex",
        flexDirection: "column",
        alignItems: isMe ? "flex-end" : "flex-start",
        transform: canReply ? `translateX(${dragX}px)` : undefined,
        transition: canReply && !dragging ? "transform 0.18s ease" : "none",
        willChange: canReply ? "transform" : undefined,
      }}>
        {!isMe && msg.from && (
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, marginBottom: 3, paddingLeft: 4 }}>
            {msg.from}
          </span>
        )}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={canReply || isMe ? onPointerMove : undefined}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onLostPointerCapture}
          onContextMenu={onContextMenu}
          style={{
            padding: "11px 16px",
            borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            background: palette?.bg ?? (isMe ? "#ffffff" : "#f5e8ee"),
            boxShadow: `4px 4px 10px ${palette?.shadow ?? (isMe ? SHADOW_D : "#d9b8c8")}, -4px -4px 10px ${SHADOW_L}`,
            fontSize: 16,
            fontWeight: 600,
            color: "#4b5563",
            lineHeight: 1.31,
            fontFamily: "'Nunito', sans-serif",
            touchAction: canReply ? "pan-y" : "auto",
            userSelect: "none",
            WebkitUserSelect: "none",
            cursor: editable ? "pointer" : (canReply ? "grab" : "default"),
            maxWidth: "100%",
          }}
        >
          {replyPreview && (
            <div style={{
              marginBottom: 8,
              padding: "6px 10px",
              borderRadius: 10,
              borderLeft: "3px solid #c084a0",
              background: isMe ? "rgba(192,132,160,0.12)" : "rgba(255,255,255,0.55)",
              fontSize: 12,
              lineHeight: 1.35,
            }}>
              <div style={{ fontWeight: 800, color: "#c084a0", marginBottom: 2 }}>
                {replyPreview.from}
              </div>
              <div style={{
                fontWeight: 600,
                color: "#6b7280",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 180,
              }}>
                {replyPreview.text}
              </div>
            </div>
          )}
          {msg.text}
        </div>
        <span style={{
          fontSize: 11, color: "#9ca3af", fontWeight: 600,
          marginTop: 4, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0,
        }}>
          {new Date(msg.time).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {isMe && <Avatar initials={initials} color={NAME_ABBR} />}
    </div>
  );
}
