import { useEffect, useState } from "react";
import { API_URL, authHeaders, NEU_BG, neu } from "../shared.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function StatCard({ label, value }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      padding: "12px 10px",
      borderRadius: 18,
      background: NEU_BG,
      boxShadow: neu(false, 3, 6),
      textAlign: "center",
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#4b5563" }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, color: "#6b8fb5", padding: "0 4px" }}>{children}</div>
  );
}

function PeriodTable({ rows }) {
  const cell = { flex: 1, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#4b5563" };
  const head = { ...cell, fontSize: 11, fontWeight: 700, color: "#9ca3af" };
  return (
    <div style={{ borderRadius: 18, boxShadow: neu(true, 3, 6), padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
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

function OnlineChart({ series, onlineNow, now }) {
  const points = [
    ...series.map((p) => ({ t: new Date(p.at).getTime(), v: p.count })),
    { t: now, v: onlineNow },
  ].filter((p) => !Number.isNaN(p.t) && now - p.t <= DAY_MS);

  if (points.length < 2) {
    return (
      <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textAlign: "center", padding: "16px 8px" }}>
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

  return (
    <div style={{ borderRadius: 18, boxShadow: neu(true, 3, 6), padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>
        <span>макс. {max}</span>
        <span>зараз {onlineNow}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 90, display: "block" }}>
        <polygon points={area} fill="rgba(107,143,181,0.15)" />
        <polyline points={line} fill="none" stroke="#6b8fb5" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: "#9ca3af", marginTop: 4 }}>
        <span>24 год тому</span>
        <span>зараз</span>
      </div>
    </div>
  );
}

export default function StatsPanel() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/admin/stats`, { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) throw new Error("bad response");
        if (!cancelled) {
          setStats({ ...data, fetchedAt: Date.now() });
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Не вдалося завантажити статистику");
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="neu-press-soft"
          onClick={load}
          disabled={loading}
          style={{
            border: "none", background: "transparent", cursor: "pointer",
            fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700, color: "#6b8fb5",
          }}
        >
          {loading ? "Оновлення..." : "Оновити"}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#c084a0", textAlign: "center" }}>{error}</div>
      )}

      {stats && (
        <>
          <div style={{ display: "flex", gap: 10 }}>
            <StatCard label="Онлайн" value={stats.online_now} />
            <StatCard label="DAU" value={stats.dau} />
            <StatCard label="Юзерів" value={stats.total_users} />
          </div>

          <PeriodTable rows={[
            { label: "Реєстрації", data: stats.registrations },
            { label: "Повідомлення", data: stats.messages },
          ]} />

          <SectionTitle>Онлайн за 24 години</SectionTitle>
          <OnlineChart series={stats.online_series || []} onlineNow={stats.online_now} now={stats.fetchedAt} />

          <SectionTitle>Топ за 7 днів</SectionTitle>
          <div style={{ borderRadius: 18, boxShadow: neu(true, 3, 6), padding: "6px 12px" }}>
            {(stats.top_users || []).length === 0 ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textAlign: "center", padding: "10px 0" }}>
                Ще немає повідомлень
              </div>
            ) : stats.top_users.map((u, i) => (
              <div key={u.username} style={{ display: "flex", justifyContent: "space-between", padding: "7px 4px" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#4b5563" }}>
                  <span style={{ color: "#9ca3af" }}>{i + 1}.</span> {u.username}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#6b8fb5" }}>{u.messages}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
