import React from 'react';
import { BoardPoint, BoardShapeObject, ShapeErasedStroke, ShapeType } from '../../types';
import { pointInPolygon } from './fillUtils';

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
  { type: 'line-v', label: 'Линия вертикальная', defaultWidth: 32, defaultHeight: 160 },
  { type: 'line-slash', label: 'Диагональ (/)', defaultWidth: 120, defaultHeight: 120 },
  { type: 'line-backslash', label: 'Диагональ (\\)', defaultWidth: 120, defaultHeight: 120 },
  { type: 'line-custom', label: 'Произвольная прямая линия', defaultWidth: 160, defaultHeight: 28 },
];

export const SHAPE_MAP = new Map<ShapeType, ShapeDefinition>(
  SHAPE_DEFINITIONS.map((def) => [def.type, def])
);

export const getShapeDefinition = (type: ShapeType): ShapeDefinition => {
  return SHAPE_MAP.get(type) || SHAPE_DEFINITIONS[0];
};

/**
 * Computes polygon vertices for polygon-based 2D shapes in local shape coordinates [0..w, 0..h].
 */
function getPolygonShapeVertices(
  type: ShapeType,
  w: number,
  h: number,
  p: number,
  innerW: number,
  innerH: number
): BoardPoint[] | null {
  switch (type) {
    case 'triangle':
      return [
        { x: w / 2, y: p },
        { x: w - p, y: h - p },
        { x: p, y: h - p },
      ];
    case 'right-triangle':
      return [
        { x: p, y: p },
        { x: w - p, y: h - p },
        { x: p, y: h - p },
      ];
    case 'right-triangle-flipped':
      return [
        { x: w - p, y: p },
        { x: w - p, y: h - p },
        { x: p, y: h - p },
      ];
    case 'rhombus':
      return [
        { x: w / 2, y: p },
        { x: w - p, y: h / 2 },
        { x: w / 2, y: h - p },
        { x: p, y: h / 2 },
      ];
    case 'trapezoid': {
      const topOffset = innerW * 0.22;
      return [
        { x: p + topOffset, y: p },
        { x: w - p - topOffset, y: p },
        { x: w - p, y: h - p },
        { x: p, y: h - p },
      ];
    }
    case 'parallelogram': {
      const shift = innerW * 0.25;
      return [
        { x: p + shift, y: p },
        { x: w - p, y: p },
        { x: w - p - shift, y: h - p },
        { x: p, y: h - p },
      ];
    }
    case 'pentagon': {
      const cx = w / 2;
      const cy = h / 2;
      const rx = innerW / 2;
      const ry = innerH / 2;
      const pts: BoardPoint[] = [];
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        pts.push({
          x: cx + rx * Math.cos(angle),
          y: cy + ry * Math.sin(angle),
        });
      }
      return pts;
    }
    case 'hexagon': {
      const inset = innerW * 0.25;
      return [
        { x: p + inset, y: p },
        { x: w - p - inset, y: p },
        { x: w - p, y: h / 2 },
        { x: w - p - inset, y: h - p },
        { x: p + inset, y: h - p },
        { x: p, y: h / 2 },
      ];
    }
    case 'star': {
      const cx = w / 2;
      const cy = h / 2;
      const rOuterX = innerW / 2;
      const rOuterY = innerH / 2;
      const rInnerX = rOuterX * 0.45;
      const rInnerY = rOuterY * 0.45;
      const pts: BoardPoint[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const rx = i % 2 === 0 ? rOuterX : rInnerX;
        const ry = i % 2 === 0 ? rOuterY : rInnerY;
        pts.push({
          x: cx + rx * Math.cos(angle),
          y: cy + ry * Math.sin(angle),
        });
      }
      return pts;
    }
    default:
      return null;
  }
}

/**
 * Computes the 3 visible faces of a 3D oblique cube in local shape coordinates [0..w, 0..h].
 */
function getCubeFacesGeometry(w: number, h: number, p: number) {
  const ox = w * 0.28;
  const oy = h * 0.28;
  const fw = Math.max(2, w - ox - p * 2);
  const fh = Math.max(2, h - oy - p * 2);
  const fx = p;
  const fy = p + oy;

  const frontPoly: BoardPoint[] = [
    { x: fx, y: fy },
    { x: fx + fw, y: fy },
    { x: fx + fw, y: fy + fh },
    { x: fx, y: fy + fh },
  ];
  const topPoly: BoardPoint[] = [
    { x: fx, y: fy },
    { x: fx + ox, y: fy - oy },
    { x: fx + fw + ox, y: fy - oy },
    { x: fx + fw, y: fy },
  ];
  const rightPoly: BoardPoint[] = [
    { x: fx + fw, y: fy },
    { x: fx + fw + ox, y: fy - oy },
    { x: fx + fw + ox, y: fy + fh - oy },
    { x: fx + fw, y: fy + fh },
  ];

  return { fx, fy, fw, fh, ox, oy, frontPoly, topPoly, rightPoly };
}

/**
 * Transforms a world coordinate (worldX, worldY) into the shape's local unrotated coordinate system [0..width, 0..height].
 */
export function worldToShapeLocal(
  shape: BoardShapeObject,
  worldX: number,
  worldY: number
): BoardPoint {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const rad = -((shape.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = worldX - cx;
  const dy = worldY - cy;
  return {
    x: dx * cos - dy * sin + shape.width / 2,
    y: dx * sin + dy * cos + shape.height / 2,
  };
}

/**
 * Exact geometric hit-test for the Fill Tool on a BoardShapeObject.
 * For 2D closed shapes, returns { hit: true } if inside the closed shape boundary.
 * For 3D volumetric shapes ('cube'), returns { hit: true, faceId } for the specific clicked face.
 * For open lines / arrows, returns { hit: false }.
 */
export function hitTestShapeFill(
  shape: BoardShapeObject,
  worldX: number,
  worldY: number
): { hit: boolean; faceId?: 'front' | 'top' | 'right' } {
  const local = worldToShapeLocal(shape, worldX, worldY);
  const lx = local.x;
  const ly = local.y;

  const w = Math.max(10, shape.width);
  const h = Math.max(10, shape.height);
  const p = Math.max(2, (shape.strokeWidth || 2.5) / 2);
  const innerW = Math.max(2, w - p * 2);
  const innerH = Math.max(2, h - p * 2);

  if (lx < 0 || lx > w || ly < 0 || ly > h) {
    return { hit: false };
  }

  switch (shape.type) {
    case 'square':
    case 'rectangle':
      return {
        hit: lx >= p && lx <= p + innerW && ly >= p && ly <= p + innerH,
      };

    case 'rounded-rectangle': {
      if (lx < p || lx > p + innerW || ly < p || ly > p + innerH) {
        return { hit: false };
      }
      const rx = Math.min(16, innerW / 4, innerH / 4);
      const minX = p + rx;
      const maxX = p + innerW - rx;
      const minY = p + rx;
      const maxY = p + innerH - rx;
      const cx = lx < minX ? minX : lx > maxX ? maxX : lx;
      const cy = ly < minY ? minY : ly > maxY ? maxY : ly;
      return {
        hit: Math.hypot(lx - cx, ly - cy) <= rx,
      };
    }

    case 'circle': {
      const r = Math.max(2, Math.min(innerW, innerH) / 2);
      return {
        hit: Math.hypot(lx - w / 2, ly - h / 2) <= r,
      };
    }

    case 'ellipse': {
      const rx = Math.max(2, innerW / 2);
      const ry = Math.max(2, innerH / 2);
      const norm = Math.pow((lx - w / 2) / rx, 2) + Math.pow((ly - h / 2) / ry, 2);
      return {
        hit: norm <= 1,
      };
    }

    case 'cube': {
      const { frontPoly, topPoly, rightPoly } = getCubeFacesGeometry(w, h, p);
      if (pointInPolygon(local, frontPoly)) {
        return { hit: true, faceId: 'front' };
      }
      if (pointInPolygon(local, topPoly)) {
        return { hit: true, faceId: 'top' };
      }
      if (pointInPolygon(local, rightPoly)) {
        return { hit: true, faceId: 'right' };
      }
      return { hit: false };
    }

    case 'triangle':
    case 'right-triangle':
    case 'right-triangle-flipped':
    case 'rhombus':
    case 'trapezoid':
    case 'parallelogram':
    case 'pentagon':
    case 'hexagon':
    case 'star': {
      const poly = getPolygonShapeVertices(shape.type, w, h, p, innerW, innerH);
      if (!poly) return { hit: false };
      return {
        hit: pointInPolygon(local, poly),
      };
    }

    default:
      // Lines and open arrows are not closed 2D/3D shapes
      return { hit: false };
  }
}

/**
 * Renders the SVG mask used when a filled shape has been partially erased by the Area Eraser.
 */
function renderErasedFillMask(
  maskId: string,
  w: number,
  h: number,
  erasedFillStrokes?: ShapeErasedStroke[]
): React.ReactNode {
  if (!erasedFillStrokes || erasedFillStrokes.length === 0) return null;
  return (
    <defs>
      <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
        <rect x={0} y={0} width={w} height={h} fill="white" />
        {erasedFillStrokes.map((ep, idx) => {
          if (!ep.points || ep.points.length === 0) return null;
          const rx = Math.max(1, ep.radiusRatioX * w);
          const ry = Math.max(1, ep.radiusRatioY * h);
          const strokeW = rx + ry;
          if (ep.points.length === 1) {
            return (
              <ellipse
                key={idx}
                cx={ep.points[0].x * w}
                cy={ep.points[0].y * h}
                rx={rx}
                ry={ry}
                fill="black"
              />
            );
          }
          const d = ep.points
            .map(
              (pt, i) =>
                `${i === 0 ? 'M' : 'L'} ${(pt.x * w).toFixed(2)} ${(pt.y * h).toFixed(2)}`
            )
            .join(' ');
          return (
            <path
              key={idx}
              d={d}
              fill="none"
              stroke="black"
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </mask>
    </defs>
  );
}

/**
 * Renders the SVG content for a given shape at target world dimensions (width, height)
 * and effective screen strokeWidth, including optional interior fill and partial-erase mask.
 */
export const renderShapeSvg = (
  type: ShapeType,
  width: number,
  height: number,
  color: string,
  strokeWidth: number = 2.5,
  worldStrokePadding: number = 2.5,
  fillColor?: string,
  faceFills?: Record<string, string>,
  erasedFillStrokes?: ShapeErasedStroke[],
  shapeId?: string
): React.ReactNode => {
  const p = Math.max(2, worldStrokePadding / 2); // padding in world coordinates to prevent stroke clipping
  const w = Math.max(10, width);
  const h = Math.max(10, height);
  const innerW = Math.max(2, w - p * 2);
  const innerH = Math.max(2, h - p * 2);

  const hasErasedMask = Boolean(erasedFillStrokes && erasedFillStrokes.length > 0);
  const maskId = `shape-fill-mask-${shapeId || 'preview'}`;
  const maskAttr = hasErasedMask ? `url(#${maskId})` : undefined;

  switch (type) {
    case 'square':
    case 'rectangle':
      return (
        <>
          {hasErasedMask && renderErasedFillMask(maskId, w, h, erasedFillStrokes)}
          {fillColor && (
            <rect
              x={p}
              y={p}
              width={innerW}
              height={innerH}
              fill={fillColor}
              stroke="none"
              mask={maskAttr}
            />
          )}
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
        </>
      );

    case 'rounded-rectangle': {
      const rx = Math.min(16, innerW / 4, innerH / 4);
      return (
        <>
          {hasErasedMask && renderErasedFillMask(maskId, w, h, erasedFillStrokes)}
          {fillColor && (
            <rect
              x={p}
              y={p}
              width={innerW}
              height={innerH}
              rx={rx}
              ry={rx}
              fill={fillColor}
              stroke="none"
              mask={maskAttr}
            />
          )}
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
        </>
      );
    }

    case 'circle': {
      const r = Math.max(2, Math.min(innerW, innerH) / 2);
      return (
        <>
          {hasErasedMask && renderErasedFillMask(maskId, w, h, erasedFillStrokes)}
          {fillColor && (
            <circle
              cx={w / 2}
              cy={h / 2}
              r={r}
              fill={fillColor}
              stroke="none"
              mask={maskAttr}
            />
          )}
          <circle
            cx={w / 2}
            cy={h / 2}
            r={r}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </>
      );
    }

    case 'ellipse': {
      const rx = Math.max(2, innerW / 2);
      const ry = Math.max(2, innerH / 2);
      return (
        <>
          {hasErasedMask && renderErasedFillMask(maskId, w, h, erasedFillStrokes)}
          {fillColor && (
            <ellipse
              cx={w / 2}
              cy={h / 2}
              rx={rx}
              ry={ry}
              fill={fillColor}
              stroke="none"
              mask={maskAttr}
            />
          )}
          <ellipse
            cx={w / 2}
            cy={h / 2}
            rx={rx}
            ry={ry}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </>
      );
    }

    case 'cube': {
      // Oblique 3D cube with independent per-face fills and wireframe on top
      const { fx, fy, fw, fh, ox, oy } = getCubeFacesGeometry(w, h, p);
      const frontFill = faceFills?.front ?? fillColor;
      const topFill = faceFills?.top ?? fillColor;
      const rightFill = faceFills?.right ?? fillColor;
      const topPts = `${fx},${fy} ${fx + ox},${fy - oy} ${fx + fw + ox},${fy - oy} ${fx + fw},${fy}`;
      const rightPts = `${fx + fw},${fy} ${fx + fw + ox},${fy - oy} ${fx + fw + ox},${fy + fh - oy} ${fx + fw},${fy + fh}`;

      return (
        <>
          {hasErasedMask && renderErasedFillMask(maskId, w, h, erasedFillStrokes)}
          {(frontFill || topFill || rightFill) && (
            <g mask={maskAttr} stroke="none">
              {frontFill && <rect x={fx} y={fy} width={fw} height={fh} fill={frontFill} />}
              {topFill && <polygon points={topPts} fill={topFill} />}
              {rightFill && <polygon points={rightPts} fill={rightFill} />}
            </g>
          )}
          <g
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            {/* Front Face */}
            <rect x={fx} y={fy} width={fw} height={fh} vectorEffect="non-scaling-stroke" />
            {/* Top Face */}
            <polygon points={topPts} vectorEffect="non-scaling-stroke" />
            {/* Right Face */}
            <polygon points={rightPts} vectorEffect="non-scaling-stroke" />
          </g>
        </>
      );
    }

    case 'triangle':
    case 'right-triangle':
    case 'right-triangle-flipped':
    case 'rhombus':
    case 'trapezoid':
    case 'parallelogram':
    case 'pentagon':
    case 'hexagon':
    case 'star': {
      const poly = getPolygonShapeVertices(type, w, h, p, innerW, innerH);
      if (!poly) return null;
      const pts = poly.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
      return (
        <>
          {hasErasedMask && renderErasedFillMask(maskId, w, h, erasedFillStrokes)}
          {fillColor && (
            <polygon points={pts} fill={fillColor} stroke="none" mask={maskAttr} />
          )}
          <polygon
            points={pts}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
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
    case 'line-custom':
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

    case 'line-v':
      return (
        <line
          x1={w / 2}
          y1={p}
          x2={w / 2}
          y2={h - p}
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
 * Full SVG component for drawing shapes on the board.
 * Scales stroke thickness proportionally with camera zoom so contours never bloat at 15% zoom
 * and never become overly thin when zooming in, while preserving uniform stroke width across
 * non-square aspect ratios via vectorEffect="non-scaling-stroke".
 */
export const renderShapeSVG = (
  type: ShapeType,
  color: string,
  width: number | string = '100%',
  height: number | string = '100%',
  strokeWidth: number = 2.5,
  viewBoxWidth: number = 100,
  viewBoxHeight: number = 100,
  zoom: number = 1,
  fillColor?: string,
  faceFills?: Record<string, string>,
  erasedFillStrokes?: ShapeErasedStroke[],
  shapeId?: string
): React.ReactNode => {
  const vbW = Math.max(10, viewBoxWidth);
  const vbH = Math.max(10, viewBoxHeight);
  const effectiveStrokeWidth = Math.max(0.35, strokeWidth * zoom);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="none"
      className="w-full h-full overflow-visible"
    >
      {renderShapeSvg(
        type,
        vbW,
        vbH,
        color,
        effectiveStrokeWidth,
        strokeWidth,
        fillColor,
        faceFills,
        erasedFillStrokes,
        shapeId
      )}
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
          case 'line-v':
            return <line x1="12" y1="3" x2="12" y2="21" />;
          case 'line-slash':
            return <line x1="4" y1="20" x2="20" y2="4" />;
          case 'line-backslash':
            return <line x1="4" y1="4" x2="20" y2="20" />;
          case 'line-custom':
            return <line x1="4" y1="20" x2="20" y2="4" strokeDasharray="3 3" />;
          default:
            return <rect x="4" y="4" width="16" height="16" />;
        }
      })()}
    </svg>
  );
};
