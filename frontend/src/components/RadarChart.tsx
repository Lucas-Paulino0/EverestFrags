/**
 * RadarChart — gráfico hexagonal SVG puro (sem biblioteca)
 *
 * 6 eixos: ADR, KAST, Rating, OpenK, Trade, Util
 * Os valores são normalizados 0–100 (os scores já vêm assim do backend).
 * Cor configurável via prop `color` (ex: "#cc2200" para o 1º, "#888" para o 2º, "#e0a82e" para o 3º).
 */

interface RadarProps {
  adr: number;       // score combate → representa ADR
  kast: number;      // score combate → representa KAST
  rating: number;    // score combate → representa Rating
  openK: number;     // score duelo → Opening Kills
  trade: number;     // k/d normalizado: kd_ratio × 33 cap 100 (0.5→16, 1.0→33, 2.0→66)
  util: number;      // score utility
  color?: string;
  size?: number;
}

// Cores por posição no pódio (teal, prata, ouro — consistente com novo design)
export const PODIUM_COLORS = ["#0e7490", "#6366f1", "#e0a82e"];

// Nome de cada eixo, na mesma ordem de `values` em RadarChart — usado nos labels
// ao redor do hexágono, pra dar pra saber qual eixo é qual sem abrir o detalhe.
const AXIS_LABELS = ["ADR", "KAST", "RATING", "OPEN K", "K/D", "UTIL"];

function polarToXY(angle: number, r: number, cx: number, cy: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function RadarChart({
  adr, kast, rating, openK, trade, util,
  color = "#0e7490",
  size = 120,
}: RadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  // Raio menor que antes (0.38 -> 0.30) pra abrir espaço pros labels dos eixos.
  const maxR = size * 0.30;
  const values = [adr, kast, rating, openK, trade, util].map(v => Math.min(100, Math.max(0, v)));
  const angles = [0, 60, 120, 180, 240, 300];

  // Polígono dos valores reais
  const dataPoints = values.map((v, i) => {
    const r = (v / 100) * maxR;
    return polarToXY(angles[i], r, cx, cy);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";

  // Grades hexagonais (25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      {/* Grades */}
      {gridLevels.map((level, li) => {
        const pts = angles.map(a => {
          const p = polarToXY(a, maxR * level, cx, cy);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        });
        return (
          <polygon
            key={li}
            points={pts.join(" ")}
            fill="none"
            stroke={li === 3 ? "#1a2530" : "rgba(26,37,48,0.7)"}
            strokeWidth={li === 3 ? 1 : 0.5}
          />
        );
      })}

      {/* Eixos */}
      {angles.map((a, i) => {
        const end = polarToXY(a, maxR, cx, cy);
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={end.x.toFixed(1)} y2={end.y.toFixed(1)}
            stroke="#1a2530"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Área do jogador */}
      <path
        d={dataPath}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Pontos nos vértices */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} />
      ))}

      {/* Labels dos eixos — fora do hexágono, alinhados conforme a posição (topo/baixo/lados) */}
      {angles.map((a, i) => {
        const pos = polarToXY(a, maxR + size * 0.1, cx, cy);
        const isTop = a === 0;
        const isBottom = a === 180;
        const isRightSide = a === 60 || a === 120;
        const textAnchor = isTop || isBottom ? "middle" : isRightSide ? "start" : "end";
        const dominantBaseline = isTop ? "text-after-edge" : isBottom ? "text-before-edge" : "middle";
        return (
          <text
            key={i}
            x={pos.x}
            y={pos.y}
            fontSize={Math.max(7.5, size * 0.05)}
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="0.3px"
            fill="#5d6d80"
            textAnchor={textAnchor}
            dominantBaseline={dominantBaseline}
          >
            {AXIS_LABELS[i]}
          </text>
        );
      })}
    </svg>
  );
}
