import { useId } from 'react';

interface TrendSparklineProps {
  values: number[];
  color: string;
  height?: number;
  label: string;
}

export default function TrendSparkline({
  values,
  color,
  height = 38,
  label,
}: TrendSparklineProps) {
  const gradId = useId();
  const safeValues = values.length >= 2 ? values : [values[0] ?? 0, values[0] ?? 0];
  const width = 180;
  const padX = 4;
  const padY = 5;

  const minVal = Math.min(...safeValues);
  const maxVal = Math.max(...safeValues);
  const span = maxVal - minVal || 1;

  const points = safeValues.map((val, idx) => {
    const x = padX + (idx / (safeValues.length - 1)) * (width - padX * 2);
    const normY = (val - minVal) / span;
    const y = height - padY - normY * (height - padY * 2);
    return { x, y };
  });

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${height} L ${first.x.toFixed(1)} ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full overflow-visible"
      style={{ height: `${height}px` }}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r="2.75" fill={color} stroke="#121418" strokeWidth="1.2" />
    </svg>
  );
}
