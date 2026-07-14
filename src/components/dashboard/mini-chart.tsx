export interface MiniChartPoint {
  label: string;
  value: number;
}

interface MiniChartProps {
  data: MiniChartPoint[];
  variant: "line" | "area" | "bar";
  color: "success" | "info" | "warning" | "violet";
  height?: number;
  formatValue?: (value: number) => string;
}

const STROKE: Record<MiniChartProps["color"], string> = {
  success: "#22c55e",
  info: "#38bdf8",
  warning: "#f59e0b",
  violet: "#a78bfa",
};

const WIDTH = 280;

export function MiniChart({
  data,
  variant,
  color,
  height = 120,
  formatValue = (v) => String(v),
}: MiniChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-muted-foreground"
      >
        No data
      </div>
    );
  }

  const gradientId = `mini-chart-gradient-${color}`;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = variant === "bar" ? 0 : Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? WIDTH / (data.length - 1) : WIDTH;
  const stroke = STROKE[color];

  const toY = (value: number) => height - ((value - min) / range) * height;

  const linePoints = data.map((d, i) => ({
    x: variant === "bar" ? (i + 0.5) * (WIDTH / data.length) : i * stepX,
    y: toY(d.value),
  }));

  const linePath = linePoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  const areaPath = `${linePath} L${linePoints[linePoints.length - 1].x},${height} L${linePoints[0].x},${height} Z`;

  const barWidth = (WIDTH / data.length) * 0.6;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>

        {variant === "area" && (
          <>
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path d={linePath} fill="none" stroke={stroke} strokeWidth={2} />
          </>
        )}

        {variant === "line" && (
          <path d={linePath} fill="none" stroke={stroke} strokeWidth={2} />
        )}

        {variant === "bar" &&
          linePoints.map((p, i) => (
            <rect
              key={data[i].label + i}
              x={p.x - barWidth / 2}
              y={p.y}
              width={barWidth}
              height={Math.max(height - p.y, 1)}
              rx={3}
              fill={stroke}
            />
          ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}
