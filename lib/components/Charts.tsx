"use client";
// ============================================
// KOMPONEN GRAFIK VISUAL (SVG murni, tanpa dependensi)
// ============================================
import { useId, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";

// ---------- util ----------
const fmtRp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

function niceMax(max: number) {
  if (max <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const unit = max / pow;
  let nice;
  if (unit <= 1) nice = 1;
  else if (unit <= 2) nice = 2;
  else if (unit <= 5) nice = 5;
  else nice = 10;
  return nice * pow;
}

interface ChartItem {
  label: string;
  value: number;
}

// ---------- StatCard ----------
export function StatCard({
  icon,
  label,
  value,
  sub,
  color = "blue",
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  trend?: number;
}) {
  const colors: Record<string, string> = {
    blue: "bg-navy/5 text-navy",
    green: "bg-olive/10 text-olive",
    purple: "bg-powder-soft text-sage-deep",
    orange: "bg-cream-soft text-[#8A795C]",
    red: "bg-red-50 text-red-600",
  };
  const Icon = icon;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-3">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${colors[color] || colors.blue}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-gray-800 truncate">{value}</p>
        {(sub || trend !== undefined) && (
          <p className="text-[11px] text-gray-400 mt-0.5">
            {trend !== undefined && (
              <span className={trend >= 0 ? "text-olive font-semibold" : "text-red-500 font-semibold"}>
                {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(0)}%{" "}
              </span>
            )}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- Area/Line chart ----------
export function AreaChart({
  data,
  height = 220,
  color = "#5c6f67",
  valueFormat = fmtRp,
}: {
  data: ChartItem[];
  height?: number;
  color?: string;
  valueFormat?: (n: number) => string;
}) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const { pts, maxVal, path, areaPath } = useMemo(() => {
    const W = 600;
    const H = height;
    const pad = { t: 14, r: 10, b: 26, l: 10 };
    const vals = data.map((d) => d.value);
    const maxVal = niceMax(Math.max(...vals, 0));
    const n = data.length;
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const pts = data.map((d, i) => ({
      ...d,
      x: pad.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
      y: pad.t + innerH - (d.value / maxVal) * innerH,
    }));
    let path = "";
    pts.forEach((p, i) => {
      if (i === 0) {
        path += `M ${p.x} ${p.y}`;
      } else {
        const prev = pts[i - 1];
        const cx = (prev.x + p.x) / 2;
        path += ` C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
      }
    });
    const last = pts[pts.length - 1];
    const areaPath =
      pts.length > 0
        ? `${path} L ${last.x} ${pad.t + innerH} L ${pts[0].x} ${pad.t + innerH} Z`
        : "";
    return { pts, maxVal, path, areaPath };
  }, [data, height]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        Belum ada data
      </div>
    );
  }

  const W = 600;
  const H = height;
  const pad = { t: 14, r: 10, b: 26, l: 10 };
  const innerH = H - pad.t - pad.b;
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => pad.t + innerH * (1 - f));
  const labelStep = Math.ceil(data.length / 7);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        <defs>
          <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* grid + y labels */}
        {gridLines.map((y, i) => (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
            <text x={W - pad.r + 2} y={y + 4} fontSize="9" fill="#9ca3af" textAnchor="start">
              {valueFormat(maxVal * (1 - i / 4))}
            </text>
          </g>
        ))}

        {/* area + line */}
        <path d={areaPath} fill={`url(#grad-${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

        {/* x labels */}
        {pts.map((p, i) =>
          i % labelStep === 0 ? (
            <text key={i} x={p.x} y={H - 8} fontSize="9" fill="#9ca3af" textAnchor="middle">
              {p.label}
            </text>
          ) : null
        )}

        {/* hover targets */}
        {pts.map((p, i) => (
          <rect
            key={`t-${i}`}
            x={p.x - W / pts.length / 2}
            y={0}
            width={W / pts.length}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {/* hover marker */}
        {hover !== null && (
          <g>
            <line
              x1={pts[hover].x}
              y1={pad.t}
              x2={pts[hover].x}
              y2={H - pad.b}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5" />
          </g>
        )}
      </svg>

      {/* tooltip */}
      {hover !== null && (
        <div
          className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap z-10"
          style={{ left: `${(pts[hover].x / W) * 100}%`, top: `${(pts[hover].y / H) * 100}%`, transform: "translate(-50%, -130%)" }}
        >
          <div className="font-semibold">{pts[hover].label}</div>
          <div>{valueFormat(pts[hover].value)}</div>
        </div>
      )}
    </div>
  );
}

// ---------- Bar chart (horizontal, untuk ranking) ----------
export function BarChart({
  items,
  color = "#5b7337",
  valueFormat = fmtRp,
  emptyText = "Belum ada data",
}: {
  items: ChartItem[];
  color?: string;
  valueFormat?: (n: number) => string;
  emptyText?: string;
}) {
  if (!items.length) {
    return <div className="flex items-center justify-center text-gray-400 text-sm py-8">{emptyText}</div>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-gray-700 truncate pr-2">{item.label}</span>
            <span className="text-gray-500 shrink-0 font-semibold">{valueFormat(item.value)}</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max((item.value / max) * 100, 2)}%`,
                background: `linear-gradient(90deg, ${color}, ${color}bb)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Donut chart ----------
export function DonutChart({
  items,
  size = 160,
  valueFormat = fmtRp,
  emptyText = "Belum ada data",
}: {
  items: ChartItem[];
  size?: number;
  valueFormat?: (n: number) => string;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((s, i) => s + i.value, 0);

  const segments = useMemo(
    () =>
      items.map((item, i) => ({
        ...item,
        index: i,
        dash: (item.value / total) * 2 * Math.PI * 60,
        offsetStart:
          items.slice(0, i).reduce((s, prev) => s + (prev.value / total) * 2 * Math.PI * 60, 0),
      })),
    [items, total]
  );

  if (!total) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height: size }}>
        {emptyText}
      </div>
    );
  }

  const r = 60;
  const cx = 80;
  const cy = 80;
  const strokeW = 22;
  const circ = 2 * Math.PI * r;

  // Palet frost-berries + turunannya agar segaris dengan tema UI
  const palette = [
    "#1d2733", // navy
    "#5c6f67", // sage
    "#5b7337", // olive
    "#a9bfc9", // powder
    "#8a795c", // cream-deep
    "#4c5d55", // sage-deep
    "#b9a88a", // cream-deep terang
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 160 160" className="shrink-0">
        {segments.map((seg) => {
          const i = seg.index;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={palette[i % palette.length]}
              strokeWidth={hover === i ? strokeW + 4 : strokeW}
              strokeDasharray={`${seg.dash} ${circ - seg.dash}`}
              strokeDashoffset={-seg.offsetStart}
              transform={`rotate(-90 ${cx} ${cy})`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: "stroke-width 0.2s", cursor: "pointer" }}
            />
          );
        })}
        <text x="80" y="76" textAnchor="middle" fontSize="11" fill="#6b7280">
          Total
        </text>
        <text x="80" y="92" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1f2937">
          {valueFormat(total)}
        </text>
      </svg>
      <div className="space-y-1.5 w-full">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-sm rounded px-1.5 py-0.5 cursor-default ${
              hover === i ? "bg-gray-50" : ""
            }`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: palette[i % palette.length] }} />
            <span className="flex-1 text-gray-700 truncate">{item.label}</span>
            <span className="text-gray-500 text-xs font-semibold">
              {((item.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
