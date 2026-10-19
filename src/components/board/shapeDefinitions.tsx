import React from 'react';
import { ShapeType } from '../../types';

export interface ShapeDefinition {
  type: ShapeType;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  isAspectRatioLocked?: boolean;
}

export const SHAPE_DEFINITIONS: ShapeDefinition[] = [
  { type: 'square', label: 'Квадрат', defaultWidth: 120, defaultHeight: 120, isAspectRatioLocked: true },
  { type: 'rectangle', label: 'Прямоугольник', defaultWidth: 160, defaultHeight: 100 },
  { type: 'rounded-rectangle', label: 'Прямоугольник со скруглёнными углами', defaultWidth: 160, defaultHeight: 100 },
  { type: 'circle', label: 'Круг', defaultWidth: 120, defaultHeight: 120, isAspectRatioLocked: true },
  { type: 'ellipse', label: 'Эллипс', defaultWidth: 160, defaultHeight: 100 },
  { type: 'triangle', label: 'Треугольник', defaultWidth: 130, defaultHeight: 110 },
  { type: 'right-triangle', label: 'Прямоугольный треугольник', defaultWidth: 130, defaultHeight: 110 },
  { type: 'right-triangle-flipped', label: 'Прямоугольный треугольник (обратный)', defaultWidth: 130, defaultHeight: 110 },
  { type: 'cube', label: 'Куб', defaultWidth: 130, defaultHeight: 130 },
  { type: 'rhombus', label: 'Ромб', defaultWidth: 130, defaultHeight: 110 },
  { type: 'trapezoid', label: 'Трапеция', defaultWidth: 150, defaultHeight: 100 },
  { type: 'parallelogram', label: 'Параллелограмм', defaultWidth: 150, defaultHeight: 100 },
  { type: 'pentagon', label: 'Пятиугольник', defaultWidth: 120, defaultHeight: 120 },
  { type: 'hexagon', label: 'Шестиугольник', defaultWidth: 130, defaultHeight: 110 },
  { type: 'star', label: 'Звезда', defaultWidth: 120, defaultHeight: 120 },
  { type: 'arrow-right', label: 'Стрелка вправо', defaultWidth: 160, defaultHeight: 36 },
  { type: 'arrow-left', label: 'Стрелка влево', defaultWidth: 160, defaultHeight: 36 },
  { type: 'arrow-up', label: 'Стрелка вверх', defaultWidth: 36, defaultHeight: 160 },
  { type: 'arrow-down', label: 'Стрелка вниз', defaultWidth: 36, defaultHeight: 160 },
  { type: 'line-h', label: 'Линия горизонтальная', defaultWidth: 160, defaultHeight: 32 },
  { type: 'line-slash', label: 'Диагональ (/)', defaultWidth: 120, defaultHeight: 120 },
  { type: 'line-backslash', label: 'Диагональ (\\)', defaultWidth: 120, defaultHeight: 120 },
];

export const SHAPE_MAP = new Map<ShapeType, ShapeDefinition>(
  SHAPE_DEFINITIONS.map((def) => [def.type, def])
);

export const getShapeDefinition = (type: ShapeType): ShapeDefinition => {
  return SHAPE_MAP.get(type) || SHAPE_DEFINITIONS[0];
};

/**
 * Renders the SVG content for a given shape at target dimensions
 */
export const renderShapeSvg = (
  type: ShapeType,
  width: number,
  height: number,
  color: string,
  strokeWidth: number = 2.5
): React.ReactNode => {
  const p = Math.max(2, strokeWidth / 2); // padding to prevent stroke clipping
  const w = Math.max(10, width);
  const h = Math.max(10, height);
  const innerW = Math.max(2, w - p * 2);
  const innerH = Math.max(2, h - p * 2);

  switch (type) {
    case 'square':
      return (
        <rect
          x={p}
          y={p}
          width={innerW}
          height={innerH}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      );

    case 'rectangle':
      return (
        <rect
          x={p}
          y={p}
          width={innerW}
          height={innerH}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      );

    case 'rounded-rectangle': {
      const rx = Math.min(16, innerW / 4, innerH / 4);
      return (
        <rect
          x={p}
          y={p}
          width={innerW}
          height={innerH}
          rx={rx}
          ry={rx}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'circle': {
      const r = Math.max(2, Math.min(innerW, innerH) / 2);
      return (
        <circle
          cx={w / 2}
          cy={h / 2}
          r={r}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'ellipse':
      return (
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={Math.max(2, innerW / 2)}
          ry={Math.max(2, innerH / 2)}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      );

    case 'triangle': {
      const pts = `${w / 2},${p} ${w - p},${h - p} ${p},${h - p}`;
      return (
        <polygon
          points={pts}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'right-triangle': {
      const pts = `${p},${p} ${w - p},${h - p} ${p},${h - p}`;
      return (
        <polygon
          points={pts}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'right-triangle-flipped': {
      const pts = `${w - p},${p} ${w - p},${h - p} ${p},${h - p}`;
      return (
        <polygon
          points={pts}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'cube': {
      // Oblique 3D cube
      const ox = w * 0.28;
      const oy = h * 0.28;
      const fw = w - ox - p * 2;
      const fh = h - oy - p * 2;
      const fx = p;
      const fy = p + oy;

      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="transparent" strokeLinejoin="round" strokeLinecap="round">
          {/* Front Face */}
          <rect x={fx} y={fy} width={fw} height={fh} vectorEffect="non-scaling-stroke" />
          {/* Top Face */}
          <polygon
            points={`${fx},${fy} ${fx + ox},${fy - oy} ${fx + fw + ox},${fy - oy} ${fx + fw},${fy}`}
            vectorEffect="non-scaling-stroke"
          />
          {/* Right Face */}
          <polygon
            points={`${fx + fw},${fy} ${fx + fw + ox},${fy - oy} ${fx + fw + ox},${fy + fh - oy} ${fx + fw},${fy + fh}`}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    }

    case 'rhombus': {
      const pts = `${w / 2},${p} ${w - p},${h / 2} ${w / 2},${h - p} ${p},${h / 2}`;
      return (
        <polygon
          points={pts}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'trapezoid': {
      const topOffset = innerW * 0.22;
      const pts = `${p + topOffset},${p} ${w - p - topOffset},${p} ${w - p},${h - p} ${p},${h - p}`;
      return (
        <polygon
          points={pts}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'parallelogram': {
      const shift = innerW * 0.25;
      const pts = `${p + shift},${p} ${w - p},${p} ${w - p - shift},${h - p} ${p},${h - p}`;
      return (
        <polygon
          points={pts}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'pentagon': {
      const cx = w / 2;
      const cy = h / 2;
      const rx = innerW / 2;
      const ry = innerH / 2;
      const points: string[] = [];
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      return (
        <polygon
          points={points.join(' ')}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'hexagon': {
      const inset = innerW * 0.25;
      const pts = `${p + inset},${p} ${w - p - inset},${p} ${w - p},${h / 2} ${w - p - inset},${h - p} ${p + inset},${h - p} ${p},${h / 2}`;
      return (
        <polygon
          points={pts}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'star': {
      const cx = w / 2;
      const cy = h / 2;
      const rOuterX = innerW / 2;
      const rOuterY = innerH / 2;
      const rInnerX = rOuterX * 0.45;
      const rInnerY = rOuterY * 0.45;
      const points: string[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const rx = i % 2 === 0 ? rOuterX : rInnerX;
        const ry = i % 2 === 0 ? rOuterY : rInnerY;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      return (
        <polygon
          points={points.join(' ')}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'arrow-right': {
      const midY = h / 2;
      const arrowLen = Math.min(14, innerW * 0.25);
      const arrowH = Math.min(10, innerH * 0.4);
      return (
        <g stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <line x1={p} y1={midY} x2={w - p - 1} y2={midY} vectorEffect="non-scaling-stroke" />
          <polygon
            points={`${w - p},${midY} ${w - p - arrowLen},${midY - arrowH} ${w - p - arrowLen},${midY + arrowH}`}
            fill={color}
            stroke={color}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    }

    case 'arrow-left': {
      const midY = h / 2;
      const arrowLen = Math.min(14, innerW * 0.25);
      const arrowH = Math.min(10, innerH * 0.4);
      return (
        <g stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <line x1={p + 1} y1={midY} x2={w - p} y2={midY} vectorEffect="non-scaling-stroke" />
          <polygon
            points={`${p},${midY} ${p + arrowLen},${midY - arrowH} ${p + arrowLen},${midY + arrowH}`}
            fill={color}
            stroke={color}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    }

    case 'arrow-up': {
      const midX = w / 2;
      const arrowLen = Math.min(14, innerH * 0.25);
      const arrowW = Math.min(10, innerW * 0.4);
      return (
        <g stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <line x1={midX} y1={p + 1} x2={midX} y2={h - p} vectorEffect="non-scaling-stroke" />
          <polygon
            points={`${midX},${p} ${midX - arrowW},${p + arrowLen} ${midX + arrowW},${p + arrowLen}`}
            fill={color}
            stroke={color}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    }

    case 'arrow-down': {
      const midX = w / 2;
      const arrowLen = Math.min(14, innerH * 0.25);
      const arrowW = Math.min(10, innerW * 0.4);
      return (
        <g stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <line x1={midX} y1={p} x2={midX} y2={h - p - 1} vectorEffect="non-scaling-stroke" />
          <polygon
            points={`${midX},${h - p} ${midX - arrowW},${h - p - arrowLen} ${midX + arrowW},${h - p - arrowLen}`}
            fill={color}
            stroke={color}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    }

    case 'line-h':
      return (
        <line
          x1={p}
          y1={h / 2}
          x2={w - p}
          y2={h / 2}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      );

    case 'line-slash':
      return (
        <line
          x1={p}
          y1={h - p}
          x2={w - p}
          y2={p}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      );

    case 'line-backslash':
      return (
        <line
          x1={p}
          y1={p}
          x2={w - p}
          y2={h - p}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      );

    default:
      return null;
  }
};

/**
 * Full SVG component for drawing shapes on the board
 */
export const renderShapeSVG = (
  type: ShapeType,
  color: string,
  width: number | string = '100%',
  height: number | string = '100%',
  strokeWidth: number = 2.5
): React.ReactNode => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full h-full overflow-visible"
    >
      {renderShapeSvg(type, 100, 100, color, strokeWidth)}
    </svg>
  );
};

/**
 * Clean monochrome 24x24 icon renderer for the popup menu
 */
export const ShapeIcon: React.FC<{ type: ShapeType; className?: string }> = ({
  type,
  className = 'w-5 h-5 text-current',
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {(() => {
        switch (type) {
          case 'square':
            return <rect x="4" y="4" width="16" height="16" />;
          case 'rectangle':
            return <rect x="3" y="6" width="18" height="12" />;
          case 'rounded-rectangle':
            return <rect x="3" y="6" width="18" height="12" rx="3" ry="3" />;
          case 'circle':
            return <circle cx="12" cy="12" r="8" />;
          case 'ellipse':
            return <ellipse cx="12" cy="12" rx="9" ry="6" />;
          case 'triangle':
            return <polygon points="12,4 20,19 4,19" />;
          case 'right-triangle':
            return <polygon points="5,5 19,19 5,19" />;
          case 'right-triangle-flipped':
            return <polygon points="19,5 19,19 5,19" />;
          case 'cube':
            return (
              <g>
                <rect x="4" y="9" width="11" height="11" />
                <polyline points="4,9 9,4 20,4 20,15 15,20" />
                <line x1="15" y1="9" x2="20" y2="4" />
              </g>
            );
          case 'rhombus':
            return <polygon points="12,3 21,12 12,21 3,12" />;
          case 'trapezoid':
            return <polygon points="7,6 17,6 21,18 3,18" />;
          case 'parallelogram':
            return <polygon points="7,5 21,5 17,19 3,19" />;
          case 'pentagon':
            return <polygon points="12,3 21,9.5 17.5,20 6.5,20 3,9.5" />;
          case 'hexagon':
            return <polygon points="7,4 17,4 21,12 17,20 7,20 3,12" />;
          case 'star':
            return <polygon points="12,2 15,8.5 22,9.3 17,14 18.5,21 12,17.5 5.5,21 7,14 2,9.3 9,8.5" />;
          case 'arrow-right':
            return (
              <g>
                <line x1="4" y1="12" x2="20" y2="12" />
                <polyline points="15,7 20,12 15,17" />
              </g>
            );
          case 'arrow-left':
            return (
              <g>
                <line x1="20" y1="12" x2="4" y2="12" />
                <polyline points="9,7 4,12 9,17" />
              </g>
            );
          case 'arrow-up':
            return (
              <g>
                <line x1="12" y1="20" x2="12" y2="4" />
                <polyline points="7,9 12,4 17,9" />
              </g>
            );
          case 'arrow-down':
            return (
              <g>
                <line x1="12" y1="4" x2="12" y2="20" />
                <polyline points="7,15 12,20 17,15" />
              </g>
            );
          case 'line-h':
            return <line x1="3" y1="12" x2="21" y2="12" />;
          case 'line-slash':
            return <line x1="4" y1="20" x2="20" y2="4" />;
          case 'line-backslash':
            return <line x1="4" y1="4" x2="20" y2="20" />;
          default:
            return <rect x="4" y="4" width="16" height="16" />;
        }
      })()}
    </svg>
  );
};
