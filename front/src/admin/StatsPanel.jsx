import { useEffect, useMemo, useState } from "react";
import { API_URL, authHeaders, NEU_BG, neu, onlineColor } from "../shared.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACCENT = "#6b8fb5";
const PINK = "#c084a0";
const MUTED = "#9ca3af";
const RECENT_PREVIEW = 10;

const boxStyle = { borderRadius: 18, boxShadow: neu(true, 3, 6), padding: "10px 12px" };

const pad2 = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dayLabel = (d) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
const timeLabel = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

function buildDays(now, count) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (count - 1 - i));
    return { key: dayKey(d), date: d };
  });
}

function StatCard({ label, value, wide }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      padding: wide ? "16px 12px" : "12px 10px",
      borderRadius: 18,
      background: NEU_BG,
      boxShadow: neu(false, 3, 6),
      textAlign: "center",
    }}>
      <div style={{ fontSize: wide ? 26 : 20, fontWeight: 800, color: "#4b5563" }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 4px", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>{children}</span>
      {right}
    </div>
  );
}

function LinkButton({ onClick, children, disabled }) {
  return (
    <button
      type="button"
      className="neu-press-soft"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "none", background: "transparent", cursor: "pointer", padding: 0,
        fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700, color: ACCENT,
      }}
    >
      {children}
    </button>
  );
}

function PeriodTable({ rows }) {
  const cell = { flex: 1, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#4b5563" };
  const head = { ...cell, fontSize: 11, fontWeight: 700, color: MUTED };
  return (
    <div style={{ ...boxStyle, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex" }}>
        <span style={{ ...head, flex: 1.4, textAlign: "left" }} />
        <span style={head}>Сьогодні</span>
        <span style={head}>7 днів</span>
        <span style={head}>30 днів</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex" }}>
          <span style={{ ...head, flex: 1.4, textAlign: "left" }}>{r.label}</span>
          <span style={cell}>{r.data.today}</span>
          <span style={cell}>{r.data.week}</span>
          <span style={cell}>{r.data.month}</span>
        </div>
      ))}
    </div>
  );
}

function OnlineChart({ series, onlineNow, now, height = 90 }) {
  const points = [
    ...series.map((p) => ({ t: new Date(p.at).getTime(), v: p.count })),
    { t: now, v: onlineNow },
  ].filter((p) => !Number.isNaN(p.t) && now - p.t <= DAY_MS);

  if (points.length < 2) {
    return (
      <div style={{ ...boxStyle, fontSize: 12, fontWeight: 600, color: MUTED, textAlign: "center", padding: "16px 8px" }}>
        Графік зʼявиться, коли назбираються дані (знімок кожні 5 хвилин)
      </div>
    );
  }

  const W = 300;
  const H = 90;
  const max = Math.max(1, ...points.map((p) => p.v));
  const start = now - DAY_MS;
  const x = (t) => ((t - start) / DAY_MS) * W;
  const y = (v) => H - (v / max) * (H - 8) - 4;
  const line = points.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${x(points[0].t).toFixed(1)},${H} ${line} ${x(points[points.length - 1].t).toFixed(1)},${H}`;
  const ticks = [24, 18, 12, 6].map((h) => ({ h, x: x(now - h * 60 * 60 * 1000) }));

  return (
    <div style={boxStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6 }}>
        <span>макс. {max}</span>
        <span>зараз {onlineNow}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
        {ticks.map((t) => (
          <line key={t.h} x1={t.x} x2={t.x} y1={0} y2={H} stroke="rgba(163,177,198,0.35)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <polygon points={area} fill="rgba(107,143,181,0.15)" />
        <polyline points={line} fill="none" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: MUTED, marginTop: 4 }}>
        <span>24 год тому</span>
        <span>18</span>
        <span>12</span>
        <span>6</span>
        <span>зараз</span>
      </div>
    </div>
  );
}

function RegistrationsChart({ days, counts, selected, onSelect, height, showValues }) {
  const max = Math.max(1, ...days.map((d) => counts.get(d.key) || 0));
  const mid = days[Math.floor(days.length / 2)];

  return (
    <div style={boxStyle}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height }}>
        {days.map((d) => {
          const count = counts.get(d.key) || 0;
          const isSel = d.key === selected;
          return (
            <button
              key={d.key}
              type="button"
              title={`${dayLabel(d.date)} — ${count}`}
              onClick={() => onSelect(isSel ? null : d.key)}
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                border: "none",
                padding: 0,
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 2,
              }}
            >
              {showValues && count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: isSel ? PINK : MUTED }}>{count}</span>
              )}
              <span style={{
                width: "100%",
                height: count ? `${Math.max(6, (count / max) * 100)}%` : 3,
                maxHeight: showValues ? "calc(100% - 16px)" : "100%",
                borderRadius: 4,
                background: isSel ? PINK : count ? "rgba(107,143,181,0.55)" : "rgba(163,177,198,0.3)",
                transition: "background 0.15s ease",
              }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: MUTED, marginTop: 6 }}>
        <span>{dayLabel(days[0].date)}</span>
        <span>{dayLabel(mid.date)}</span>
        <span>сьогодні</span>
      </div>
    </div>
  );
}

function RegistrationsList({ regs, selectedDate, onClear, limit, fill }) {
  const shown = limit ? regs.slice(0, limit) : regs;
  return (
    <div style={{
      ...boxStyle,
      padding: "6px 12px",
      ...(fill ? { flex: 1, minHeight: 0, overflowY: "auto" } : {}),
    }}>
      {shown.length === 0 ? (
        <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textAlign: "center", padding: "10px 0" }}>
          {selectedDate ? "Цього дня ніхто не зареєструвався" : "Немає реєстрацій"}
        </div>
      ) : shown.map((r) => {
        const d = new Date(r.created_at);
        return (
          <div key={`${r.username}-${r.created_at}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 4px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: onlineColor(r.gender), flexShrink: 0 }} />
            <span style={{
              fontSize: 13, fontWeight: 700, color: "#4b5563",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{r.username}</span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: MUTED, flexShrink: 0 }}>
              {selectedDate ? timeLabel(d) : `${dayLabel(d)} · ${timeLabel(d)}`}
            </span>
          </div>
        );
      })}
      {selectedDate && (
        <div style={{ textAlign: "center", padding: "4px 0 6px" }}>
          <LinkButton onClick={onClear}>показати всі</LinkButton>
        </div>
      )}
    </div>
  );
}

function TopUsers({ users }) {
  return (
    <div style={{ ...boxStyle, padding: "6px 12px" }}>
      {users.length === 0 ? (
        <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textAlign: "center", padding: "10px 0" }}>
          Ще немає повідомлень
        </div>
      ) : users.map((u, i) => (
        <div key={u.username} style={{ display: "flex", justifyContent: "space-between", padding: "7px 4px" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#4b5563" }}>
            <span style={{ color: MUTED }}>{i + 1}.</span> {u.username}
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>{u.messages}</span>
        </div>
      ))}
    </div>
  );
}

async function fetchJSON(path) {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error("bad response");
  return data;
}

export default function StatsPanel({ wide = false }) {
  const [stats, setStats] = useState(null);
  const [regs, setRegs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([fetchJSON("/api/admin/stats"), fetchJSON("/api/admin/registrations")])
      .then(([s, r]) => {
        if (cancelled) return;
        if (s.status === "fulfilled") {
          setStats({ ...s.value, fetchedAt: Date.now() });
          setError("");
        } else {
          setError("Не вдалося завантажити статистику");
        }
        if (r.status === "fulfilled" && Array.isArray(r.value)) setRegs(r.value);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const load = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const fetchedAt = stats?.fetchedAt;
  const days = useMemo(
    () => buildDays(fetchedAt ?? 0, wide ? 30 : 14),
    [fetchedAt, wide],
  );
  const counts = useMemo(() => {
    const m = new Map();
    for (const r of regs) {
      const k = dayKey(new Date(r.created_at));
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [regs]);

  const firstDay = days[0]?.key;
  const listRegs = useMemo(
    () => regs.filter((r) => {
      const k = dayKey(new Date(r.created_at));
      return selectedDay ? k === selectedDay : k >= firstDay;
    }),
    [regs, selectedDay, firstDay],
  );
  const selectedDate = days.find((d) => d.key === selectedDay)?.date;

  const regsTitle = (
    <SectionTitle right={
      <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>
        {selectedDate ? `${dayLabel(selectedDate)} · ${listRegs.length}` : "натисніть на стовпчик"}
      </span>
    }>
      Реєстрації за {days.length} днів
    </SectionTitle>
  );

  const regsChart = (
    <RegistrationsChart
      days={days}
      counts={counts}
      selected={selectedDay}
      onSelect={setSelectedDay}
      height={wide ? 180 : 80}
      showValues={wide}
    />
  );

  const regsListTitle = (
    <SectionTitle>
      {selectedDate ? `Хто зареєструвався ${dayLabel(selectedDate)}` : "Останні реєстрації"}
    </SectionTitle>
  );

  const periodTable = stats && (
    <PeriodTable rows={[
      { label: "Реєстрації", data: stats.registrations },
      { label: "Повідомлення", data: stats.messages },
    ]} />
  );

  if (wide) {
    return (
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "22px 28px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#4b5563" }}>Статистика</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>
              {fetchedAt ? `Оновлено о ${timeLabel(new Date(fetchedAt))}` : "Завантаження..."}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <LinkButton onClick={load} disabled={loading}>{loading ? "Оновлення..." : "Оновити"}</LinkButton>
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 12, fontWeight: 700, color: PINK, textAlign: "center" }}>{error}</div>
        )}

        {stats && (
          <>
            <div style={{ display: "flex", gap: 14 }}>
              <StatCard wide label="Онлайн" value={stats.online_now} />
              <StatCard wide label="DAU" value={stats.dau} />
              <StatCard wide label="Юзерів" value={stats.total_users} />
              <StatCard wide label="Нових за 7 днів" value={stats.registrations.week} />
              <StatCard wide label="Повідомлень сьогодні" value={stats.messages.today} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <SectionTitle>Онлайн за 24 години</SectionTitle>
                <OnlineChart series={stats.online_series || []} onlineNow={stats.online_now} now={fetchedAt} height={180} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <SectionTitle>Періоди</SectionTitle>
                {periodTable}
                <SectionTitle>Топ за 7 днів</SectionTitle>
                <TopUsers users={(stats.top_users || []).slice(0, 5)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {regsTitle}
                {regsChart}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 262 }}>
                {regsListTitle}
                <RegistrationsList
                  regs={listRegs}
                  selectedDate={selectedDate}
                  onClear={() => setSelectedDay(null)}
                  fill
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <LinkButton onClick={load} disabled={loading}>{loading ? "Оновлення..." : "Оновити"}</LinkButton>
      </div>

      {error && (
        <div style={{ fontSize: 12, fontWeight: 700, color: PINK, textAlign: "center" }}>{error}</div>
      )}

      {stats && (
        <>
          <div style={{ display: "flex", gap: 10 }}>
            <StatCard label="Онлайн" value={stats.online_now} />
            <StatCard label="DAU" value={stats.dau} />
            <StatCard label="Юзерів" value={stats.total_users} />
          </div>

          {periodTable}

          <SectionTitle>Онлайн за 24 години</SectionTitle>
          <OnlineChart series={stats.online_series || []} onlineNow={stats.online_now} now={fetchedAt} />

          {regsTitle}
          {regsChart}
          {regsListTitle}
          <RegistrationsList
            regs={listRegs}
            selectedDate={selectedDate}
            onClear={() => setSelectedDay(null)}
            limit={selectedDay ? 0 : RECENT_PREVIEW}
          />

          <SectionTitle>Топ за 7 днів</SectionTitle>
          <TopUsers users={stats.top_users || []} />
        </>
      )}
    </div>
  );
}
