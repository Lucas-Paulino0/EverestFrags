/**
 * CategoryBar — barra de progresso para score de categoria
 *
 * Cores padrão do rebrand:
 *   Combate → #0e7490 (teal)  | número em #22d3ee
 *   Duelos  → #6366f1 (indigo)| número em #818cf8
 *   Utility → #e0a82e (ouro)  | número em #e8b948
 */

interface CategoryBarProps {
  label: string;
  value: number;       // 0–100
  color: string;       // cor da barra
  textColor?: string;  // cor do número (opcional, default = color)
  height?: number;     // altura da barra em px (default 5)
}

export function CategoryBar({ label, value, color, textColor, height = 5 }: CategoryBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 9.5, letterSpacing: "1.5px", color: "#5d6d80" }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: textColor ?? color }}>
          {Math.round(clamped)}
        </span>
      </div>
      <div style={{ height, background: "#151d26" }}>
        <div
          className="ef-bar-grow"
          style={{
            height: "100%",
            width: `${clamped}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
