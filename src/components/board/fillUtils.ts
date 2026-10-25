import { BoardPoint, BoardStroke, StrokeErasedPath, StrokeFillRegion } from '../../types';

/**
 * Standard ray-casting point-in-polygon check.
 */
export function pointInPolygon(pt: BoardPoint, polygon: BoardPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Unsigned polygon area via Shoelace formula.
 */
export function polygonArea(polygon: BoardPoint[]): number {
  if (polygon.length < 3) return 0;
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
  }
  return Math.abs(sum) * 0.5;
}

/**
 * Closest point on segment [v, w] to point p.
 */
export function closestPointOnSegment(p: BoardPoint, v: BoardPoint, w: BoardPoint): BoardPoint {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return { x: v.x, y: v.y };
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y),
  };
}

/**
 * Euclidean distance from point p to segment [v, w].
 */
export function distToSegment(p: BoardPoint, v: BoardPoint, w: BoardPoint): number {
  const cp = closestPointOnSegment(p, v, w);
  return Math.hypot(p.x - cp.x, p.y - cp.y);
}

/**
 * Exact intersection point of two line segments [p1, p2] and [p3, p4], or null if they don't intersect.
 */
export function segmentIntersection(
  p1: BoardPoint,
  p2: BoardPoint,
  p3: BoardPoint,
  p4: BoardPoint
): BoardPoint | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: p1.x + t * d1x,
      y: p1.y + t * d1y,
    };
  }
  return null;
}

/**
 * Checks if a world point (x, y) lies inside an erased path of a stroke's fill.
 */
export function isPointErasedInStroke(
  erasedFillStrokes: StrokeErasedPath[] | undefined,
  x: number,
  y: number
): boolean {
  if (!erasedFillStrokes || erasedFillStrokes.length === 0) return false;
  const pt = { x, y };
  for (let i = 0; i < erasedFillStrokes.length; i++) {
    const ep = erasedFillStrokes[i];
    const pts = ep.points;
    if (!pts || pts.length === 0) continue;
    if (pts.length === 1) {
      if (Math.hypot(x - pts[0].x, y - pts[0].y) <= ep.radius) return true;
      continue;
    }
    for (let j = 0; j < pts.length - 1; j++) {
      if (distToSegment(pt, pts[j], pts[j + 1]) <= ep.radius) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Returns the index of the StrokeFillRegion in stroke.fillPolygons containing (x, y)
 * (ignoring regions where (x, y) has been erased by the Area Eraser), or -1 if none.
 */
export function findStrokeFillRegionAtPoint(
  stroke: BoardStroke,
  x: number,
  y: number,
  ignoreErasedMask = false
): number {
  const regions = stroke.fillPolygons;
  if (!regions || regions.length === 0) return -1;
  if (!ignoreErasedMask && isPointErasedInStroke(stroke.erasedFillStrokes, x, y)) {
    return -1;
  }
  const pt = { x, y };
  for (let i = regions.length - 1; i >= 0; i--) {
    if (pointInPolygon(pt, regions[i].points)) {
      return i;
    }
  }
  return -1;
}

/**
 * Checks whether (x, y) hits the visible (non-erased) fill of a stroke.
 */
export function isPointInStrokeFill(stroke: BoardStroke, x: number, y: number): boolean {
  return findStrokeFillRegionAtPoint(stroke, x, y, false) !== -1;
}

/**
 * Computes the complete world bounding box of a stroke including both its outline points and any fillPolygons.
 */
export function getStrokeFullBounds(stroke: BoardStroke): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < stroke.points.length; i++) {
    const p = stroke.points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  if (stroke.fillPolygons) {
    for (let i = 0; i < stroke.fillPolygons.length; i++) {
      const fp = stroke.fillPolygons[i];
      for (let j = 0; j < fp.points.length; j++) {
        const p = fp.points[j];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Transforms a stroke's points, fillPolygons, and erasedFillStrokes using a point mapper and optional radius scale.
 */
export function mapStrokeGeometry(
  stroke: {
    id: string;
    points: BoardPoint[];
    fillPolygons?: StrokeFillRegion[];
    erasedFillStrokes?: StrokeErasedPath[];
  },
  mapPt: (p: BoardPoint) => BoardPoint,
  radiusScale = 1
): {
  id: string;
  points: BoardPoint[];
  fillPolygons?: StrokeFillRegion[];
  erasedFillStrokes?: StrokeErasedPath[];
} {
  return {
    id: stroke.id,
    points: stroke.points.map(mapPt),
    fillPolygons: stroke.fillPolygons
      ? stroke.fillPolygons.map((fp) => ({
          ...fp,
          points: fp.points.map(mapPt),
        }))
      : undefined,
    erasedFillStrokes: stroke.erasedFillStrokes
      ? stroke.erasedFillStrokes.map((ep) => ({
          ...ep,
          points: ep.points.map(mapPt),
          radius: Math.max(1, Math.round(ep.radius * radiusScale * 10) / 10),
        }))
      : undefined,
  };
}

/**
 * Checks if a single freehand stroke forms a simple closed loop (without complex internal self-intersections)
 * that encloses clickPt.
 */
function findSimpleSingleStrokeLoop(
  stroke: BoardStroke,
  clickPt: BoardPoint
): { points: BoardPoint[]; area: number } | null {
  const pts = stroke.points;
  if (!pts || pts.length < 4) return null;

  const cumLen: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    cumLen.push(cumLen[i - 1] + d);
  }
  const totalLen = cumLen[cumLen.length - 1];
  if (totalLen < 28) return null;

  // Count non-adjacent segment intersections to detect if the stroke is a simple loop vs figure-8
  const intersections: Array<{ i: number; j: number; pt: BoardPoint }> = [];
  for (let i = 0; i < pts.length - 2; i++) {
    for (let j = i + 2; j < pts.length - 1; j++) {
      if (cumLen[j] - cumLen[i + 1] < Math.max(16, stroke.width * 3)) continue;
      const hit = segmentIntersection(pts[i], pts[i + 1], pts[j], pts[j + 1]);
      if (hit) {
        intersections.push({ i, j, pt: hit });
      }
    }
  }

  // Case 1: Zero self-intersections — check if start and end points meet within closure tolerance
  if (intersections.length === 0) {
    const endGap = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
    const maxAllowedGap = Math.max(18, stroke.width * 3.2, Math.min(34, totalLen * 0.1));
    if (endGap <= maxAllowedGap && endGap <= totalLen * 0.18) {
      if (pointInPolygon(clickPt, pts)) {
        const area = polygonArea(pts);
        if (area >= 30) {
          return { points: pts.map((p) => ({ x: p.x, y: p.y })), area };
        }
      }
    }

    // Also check if start/end tails pass visually close (within stroke ink thickness) without crossing centerlines
    const touchDist = Math.max(10, stroke.width * 1.8);
    let bestLoop: { points: BoardPoint[]; area: number; gap: number } | null = null;
    const maxStartIdx = Math.min(pts.length - 3, Math.floor(pts.length * 0.25));
    const minEndIdx = Math.max(maxStartIdx + 2, Math.floor(pts.length * 0.75));

    for (let i = 0; i <= maxStartIdx; i++) {
      for (let j = minEndIdx; j < pts.length; j++) {
        if (cumLen[j] - cumLen[i] < totalLen * 0.65) continue;
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d <= touchDist) {
          if (!bestLoop || d < bestLoop.gap) {
            const subPts = pts.slice(i, j + 1);
            if (pointInPolygon(clickPt, subPts)) {
              const area = polygonArea(subPts);
              if (area >= 30) {
                bestLoop = { points: subPts.map((p) => ({ x: p.x, y: p.y })), area, gap: d };
              }
            }
          }
        }
      }
    }
    if (bestLoop) {
      return { points: bestLoop.points, area: bestLoop.area };
    }
    return null;
  }

  // Case 2: Exactly 1 self-intersection (e.g. hand-drawn circle where start and end tails cross in an 'X')
  if (intersections.length === 1) {
    const { i, j, pt } = intersections[0];
    const loopPts = [
      { x: pt.x, y: pt.y },
      ...pts.slice(i + 1, j + 1).map((p) => ({ x: p.x, y: p.y })),
      { x: pt.x, y: pt.y },
    ];
    if (pointInPolygon(clickPt, loopPts)) {
      const area = polygonArea(loopPts);
      if (area >= 30) {
        return { points: loopPts, area };
      }
    }
  }

  return null;
}

/**
 * Ramer-Douglas-Peucker polyline simplification.
 */
function simplifyPolygon(points: BoardPoint[], epsilon: number): BoardPoint[] {
  if (points.length <= 4) return points;

  const rdp = (pts: BoardPoint[], start: number, end: number, out: boolean[]) => {
    let maxDist = 0;
    let index = start;
    const pStart = pts[start];
    const pEnd = pts[end];

    for (let i = start + 1; i < end; i++) {
      const d = distToSegment(pts[i], pStart, pEnd);
      if (d > maxDist) {
        index = i;
        maxDist = d;
      }
    }

    if (maxDist > epsilon && index !== start) {
      out[index] = true;
      rdp(pts, start, index, out);
      rdp(pts, index, end, out);
    }
  };

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  const mid = Math.floor(points.length / 2);
  keep[mid] = true;
  keep[points.length - 1] = true;

  rdp(points, 0, mid, keep);
  rdp(points, mid, points.length - 1, keep);

  const result: BoardPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) result.push(points[i]);
  }
  return result.length >= 3 ? result : points;
}

/**
 * Traces the outer boundary of a 4-connected binary region (that does not touch the grid border)
 * using exact grid cell-edge half-edge traversal. Guaranteed to terminate and form a closed loop.
 */
function traceMaskOuterBoundary(mask: Uint8Array, gridW: number, gridH: number): BoardPoint[] {
  // Find topmost-leftmost filled pixel (gx, gy)
  let startX = -1;
  let startY = -1;
  outer: for (let y = 1; y < gridH - 1; y++) {
    const rowOffset = y * gridW;
    for (let x = 1; x < gridW - 1; x++) {
      if (mask[rowOffset + x] === 1) {
        startX = x;
        startY = y;
        break outer;
      }
    }
  }

  if (startX === -1 || startY === -1) return [];

  const isFilled = (x: number, y: number): boolean => {
    if (x < 0 || x >= gridW || y < 0 || y >= gridH) return false;
    return mask[y * gridW + x] === 1;
  };

  // Directions in clockwise order around a filled cell:
  // 0: East (+1, 0)  [top edge of pixel (vx, vy), filled pixel is (vx, vy), empty is (vx, vy - 1)]
  // 1: South (0, +1) [right edge of pixel (vx - 1, vy), filled pixel is (vx - 1, vy), empty is (vx, vy)]
  // 2: West (-1, 0)  [bottom edge of pixel (vx - 1, vy - 1), filled pixel is (vx - 1, vy - 1), empty is (vx - 1, vy)]
  // 3: North (0, -1) [left edge of pixel (vx, vy - 1), filled pixel is (vx, vy - 1), empty is (vx - 1, vy - 1)]
  const dx = [1, 0, -1, 0];
  const dy = [0, 1, 0, -1];

  const hasBoundaryEdge = (vx: number, vy: number, dir: number): boolean => {
    if (dir === 0) return isFilled(vx, vy) && !isFilled(vx, vy - 1);
    if (dir === 1) return isFilled(vx - 1, vy) && !isFilled(vx, vy);
    if (dir === 2) return isFilled(vx - 1, vy - 1) && !isFilled(vx - 1, vy);
    return isFilled(vx, vy - 1) && !isFilled(vx - 1, vy - 1);
  };

  const contour: BoardPoint[] = [];
  let vx = startX;
  let vy = startY;
  let dir = 0; // Start moving East along top edge of (startX, startY)
  const maxSteps = gridW * gridH * 2;

  for (let step = 0; step < maxSteps; step++) {
    contour.push({ x: vx, y: vy });
    vx += dx[dir];
    vy += dy[dir];

    if (vx === startX && vy === startY) {
      break;
    }

    // Turn priority (keep exterior on the left, interior on the right):
    // Try turning Left (dir + 3), Straight (dir), Right (dir + 1), Back (dir + 2)
    const tryDirs = [(dir + 3) % 4, dir, (dir + 1) % 4, (dir + 2) % 4];
    for (let k = 0; k < 4; k++) {
      const candidate = tryDirs[k];
      if (hasBoundaryEdge(vx, vy, candidate)) {
        dir = candidate;
        break;
      }
    }
  }

  return contour;
}

/**
 * Finds a closed contour containing clickPt formed either by a single closed stroke
 * or by intersecting/touching strokes (such as a multi-stroke polygon, figure-8, or divided shape).
 * Returns null if clickPt is inside an open contour or empty canvas space.
 */
export function findClosedContourForFill(
  strokes: BoardStroke[],
  clickPt: BoardPoint
): {
  ownerStrokeId: string;
  boundStrokeIds: string[];
  points: BoardPoint[];
  isSmoothCurve: boolean;
} | null {
  const validStrokes = strokes.filter((s) => s.points && s.points.length >= 2);
  if (validStrokes.length === 0) return null;

  // 1. Build padded bounding boxes for each stroke
  const boxes = validStrokes.map((s) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < s.points.length; i++) {
      const p = s.points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = Math.max(18, s.width * 3);
    return {
      stroke: s,
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
    };
  });

  // 2. Group overlapping stroke bounding boxes into connected clusters
  const visitedCluster = new Uint8Array(boxes.length);
  const matchingClusters: Array<{
    strokes: BoardStroke[];
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }> = [];

  for (let i = 0; i < boxes.length; i++) {
    if (visitedCluster[i]) continue;
    visitedCluster[i] = 1;
    const queue = [i];
    const clusterStrokes: BoardStroke[] = [];
    let cMinX = Infinity;
    let cMinY = Infinity;
    let cMaxX = -Infinity;
    let cMaxY = -Infinity;

    while (queue.length > 0) {
      const currIdx = queue.pop()!;
      const b = boxes[currIdx];
      clusterStrokes.push(b.stroke);
      if (b.minX < cMinX) cMinX = b.minX;
      if (b.minY < cMinY) cMinY = b.minY;
      if (b.maxX > cMaxX) cMaxX = b.maxX;
      if (b.maxY > cMaxY) cMaxY = b.maxY;

      for (let j = 0; j < boxes.length; j++) {
        if (visitedCluster[j]) continue;
        const bj = boxes[j];
        const overlaps = !(
          b.maxX < bj.minX ||
          b.minX > bj.maxX ||
          b.maxY < bj.minY ||
          b.minY > bj.maxY
        );
        if (overlaps) {
          visitedCluster[j] = 1;
          queue.push(j);
        }
      }
    }

    if (
      clickPt.x >= cMinX &&
      clickPt.x <= cMaxX &&
      clickPt.y >= cMinY &&
      clickPt.y <= cMaxY
    ) {
      matchingClusters.push({
        strokes: clusterStrokes,
        minX: cMinX,
        minY: cMinY,
        maxX: cMaxX,
        maxY: cMaxY,
      });
    }
  }

  if (matchingClusters.length === 0) return null;

  // 3. Fast-Path: Check if a single simple closed stroke encloses clickPt without any other stroke dividing/crossing it
  for (let cIdx = matchingClusters.length - 1; cIdx >= 0; cIdx--) {
    const cluster = matchingClusters[cIdx];
    let bestSingleCandidate: {
      stroke: BoardStroke;
      points: BoardPoint[];
      area: number;
    } | null = null;

    for (let sIdx = cluster.strokes.length - 1; sIdx >= 0; sIdx--) {
      const s = cluster.strokes[sIdx];
      const simpleLoop = findSimpleSingleStrokeLoop(s, clickPt);
      if (simpleLoop) {
        if (!bestSingleCandidate || simpleLoop.area < bestSingleCandidate.area) {
          bestSingleCandidate = {
            stroke: s,
            points: simpleLoop.points,
            area: simpleLoop.area,
          };
        }
      }
    }

    if (bestSingleCandidate) {
      // Check if any OTHER stroke in the cluster has points inside or segments crossing bestSingleCandidate
      const candStroke = bestSingleCandidate.stroke;
      const candPoly = bestSingleCandidate.points;
      let isDividedByOtherStroke = false;

      for (let k = 0; k < cluster.strokes.length; k++) {
        const other = cluster.strokes[k];
        if (other.id === candStroke.id) continue;
        for (let m = 0; m < other.points.length; m++) {
          if (pointInPolygon(other.points[m], candPoly)) {
            isDividedByOtherStroke = true;
            break;
          }
        }
        if (isDividedByOtherStroke) break;
      }

      if (!isDividedByOtherStroke) {
        return {
          ownerStrokeId: candStroke.id,
          boundStrokeIds: [candStroke.id],
          points: candPoly,
          isSmoothCurve: true,
        };
      }
    }
  }

  // 4. General Offscreen Flood-Fill + Boundary Tracer (handles multi-stroke contours, figure-8s, divided shapes)
  for (let cIdx = matchingClusters.length - 1; cIdx >= 0; cIdx--) {
    const cluster = matchingClusters[cIdx];
    const margin = 24;
    const originX = cluster.minX - margin;
    const originY = cluster.minY - margin;
    const worldW = Math.max(40, cluster.maxX - cluster.minX + margin * 2);
    const worldH = Math.max(40, cluster.maxY - cluster.minY + margin * 2);

    const scale = Math.min(2.5, Math.max(0.45, 420 / Math.max(worldW, worldH)));
    const gridW = Math.max(36, Math.ceil(worldW * scale));
    const gridH = Math.max(36, Math.ceil(worldH * scale));

    const offCanvas = document.createElement('canvas');
    offCanvas.width = gridW;
    offCanvas.height = gridH;
    const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;

    ctx.clearRect(0, 0, gridW, gridH);
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let sumStrokeWidth = 0;
    for (let i = 0; i < cluster.strokes.length; i++) {
      const s = cluster.strokes[i];
      sumStrokeWidth += s.width;
      const pts = s.points;
      if (pts.length < 2) continue;

      ctx.lineWidth = Math.max(3, s.width * scale);
      ctx.beginPath();
      ctx.moveTo((pts[0].x - originX) * scale, (pts[0].y - originY) * scale);
      for (let j = 1; j < pts.length - 1; j++) {
        const xc = (pts[j].x + pts[j + 1].x) / 2;
        const yc = (pts[j].y + pts[j + 1].y) / 2;
        ctx.quadraticCurveTo(
          (pts[j].x - originX) * scale,
          (pts[j].y - originY) * scale,
          (xc - originX) * scale,
          (yc - originY) * scale
        );
      }
      const last = pts[pts.length - 1];
      ctx.lineTo((last.x - originX) * scale, (last.y - originY) * scale);

      // Seal small single-stroke hand-drawn endpoint gap
      let strokeLen = 0;
      for (let j = 1; j < pts.length; j++) {
        strokeLen += Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y);
      }
      const selfGap = Math.hypot(pts[0].x - last.x, pts[0].y - last.y);
      if (selfGap <= Math.max(16, s.width * 3) && strokeLen >= Math.max(36, selfGap * 4)) {
        ctx.lineTo((pts[0].x - originX) * scale, (pts[0].y - originY) * scale);
      }
      ctx.stroke();

      // Bridge small corner gaps between endpoints of this stroke and other strokes in the cluster
      const endpoints = [pts[0], last];
      const maxBridgeDist = Math.max(12, s.width * 2.5);
      for (const ep of endpoints) {
        for (let k = 0; k < cluster.strokes.length; k++) {
          if (k === i) continue;
          const other = cluster.strokes[k];
          for (let m = 0; m < other.points.length - 1; m++) {
            const cp = closestPointOnSegment(ep, other.points[m], other.points[m + 1]);
            const d = Math.hypot(ep.x - cp.x, ep.y - cp.y);
            if (d <= maxBridgeDist) {
              ctx.beginPath();
              ctx.moveTo((ep.x - originX) * scale, (ep.y - originY) * scale);
              ctx.lineTo((cp.x - originX) * scale, (cp.y - originY) * scale);
              ctx.stroke();
            }
          }
        }
      }
    }

    const avgStrokeWidth = sumStrokeWidth / cluster.strokes.length;
    const imgData = ctx.getImageData(0, 0, gridW, gridH).data;
    const wallMask = new Uint8Array(gridW * gridH);
    for (let idx = 0; idx < gridW * gridH; idx++) {
      if (imgData[idx * 4 + 3] > 90) {
        wallMask[idx] = 1;
      }
    }

    let seedX = Math.round((clickPt.x - originX) * scale);
    let seedY = Math.round((clickPt.y - originY) * scale);
    if (seedX <= 0 || seedX >= gridW - 1 || seedY <= 0 || seedY >= gridH - 1) {
      continue;
    }

    // If click landed right on the edge of a wall pixel, search a tiny 3px neighborhood
    if (wallMask[seedY * gridW + seedX] === 1) {
      let foundSeed = false;
      for (let r = 1; r <= 3 && !foundSeed; r++) {
        for (let dy = -r; dy <= r && !foundSeed; dy++) {
          for (let dx = -r; dx <= r && !foundSeed; dx++) {
            const nx = seedX + dx;
            const ny = seedY + dy;
            if (nx > 0 && nx < gridW - 1 && ny > 0 && ny < gridH - 1) {
              if (wallMask[ny * gridW + nx] === 0) {
                seedX = nx;
                seedY = ny;
                foundSeed = true;
              }
            }
          }
        }
      }
      if (!foundSeed) continue;
    }

    // 4-connected BFS flood fill
    const visited = new Uint8Array(gridW * gridH);
    const queue = new Int32Array(gridW * gridH);
    let head = 0;
    let tail = 0;

    const startIdx = seedY * gridW + seedX;
    visited[startIdx] = 1;
    queue[tail++] = startIdx;

    let leakedToBorder = false;
    while (head < tail) {
      const curr = queue[head++];
      const cy = (curr / gridW) | 0;
      const cx = curr - cy * gridW;

      if (cx === 0 || cx === gridW - 1 || cy === 0 || cy === gridH - 1) {
        leakedToBorder = true;
        break;
      }

      // Left
      const l = curr - 1;
      if (visited[l] === 0 && wallMask[l] === 0) {
        visited[l] = 1;
        queue[tail++] = l;
      }
      // Right
      const r = curr + 1;
      if (visited[r] === 0 && wallMask[r] === 0) {
        visited[r] = 1;
        queue[tail++] = r;
      }
      // Up
      const u = curr - gridW;
      if (visited[u] === 0 && wallMask[u] === 0) {
        visited[u] = 1;
        queue[tail++] = u;
      }
      // Down
      const d = curr + gridW;
      if (visited[d] === 0 && wallMask[d] === 0) {
        visited[d] = 1;
        queue[tail++] = d;
      }
    }

    // If flood-fill reached the border of the bounding box, the contour is NOT closed!
    if (leakedToBorder || tail < 16) {
      continue;
    }

    // Dilate the interior mask halfway into the wall so the fill boundary sits directly under the stroke centerline
    const dilateIterations = Math.max(1, Math.min(6, Math.ceil((avgStrokeWidth * scale) / 2)));
    let currentMask = visited;
    for (let iter = 0; iter < dilateIterations; iter++) {
      const nextMask = new Uint8Array(currentMask);
      for (let y = 1; y < gridH - 1; y++) {
        const row = y * gridW;
        for (let x = 1; x < gridW - 1; x++) {
          const idx = row + x;
          if (currentMask[idx] === 1) continue;
          if (
            currentMask[idx - 1] === 1 ||
            currentMask[idx + 1] === 1 ||
            currentMask[idx - gridW] === 1 ||
            currentMask[idx + gridW] === 1 ||
            currentMask[idx - gridW - 1] === 1 ||
            currentMask[idx - gridW + 1] === 1 ||
            currentMask[idx + gridW - 1] === 1 ||
            currentMask[idx + gridW + 1] === 1
          ) {
            nextMask[idx] = 1;
          }
        }
      }
      currentMask = nextMask;
    }

    const rawGridContour = traceMaskOuterBoundary(currentMask, gridW, gridH);
    if (rawGridContour.length < 3) continue;

    // Convert grid contour to world coordinates
    let worldContour: BoardPoint[] = rawGridContour.map((gp) => ({
      x: gp.x / scale + originX,
      y: gp.y / scale + originY,
    }));

    // Smooth staircase artifacts (2 passes of neighbor averaging)
    for (let pass = 0; pass < 2; pass++) {
      const smoothed: BoardPoint[] = [];
      const n = worldContour.length;
      for (let i = 0; i < n; i++) {
        const prev = worldContour[(i - 1 + n) % n];
        const curr = worldContour[i];
        const next = worldContour[(i + 1) % n];
        smoothed.push({
          x: curr.x * 0.5 + (prev.x + next.x) * 0.25,
          y: curr.y * 0.5 + (prev.y + next.y) * 0.25,
        });
      }
      worldContour = smoothed;
    }

    // Simplify polygon
    worldContour = simplifyPolygon(worldContour, Math.max(0.5, 0.9 / scale));

    // Snap contour vertices onto the exact nearest stroke centerline segments and record bounding strokes
    const boundStrokeSet = new Set<string>();
    const snapTolerance = Math.max(4, avgStrokeWidth * 0.85 + 2 / scale);

    const snappedContour = worldContour.map((pt) => {
      let bestDist = Infinity;
      let bestSnap: BoardPoint | null = null;
      let bestStrokeId: string | null = null;

      for (let sIdx = 0; sIdx < cluster.strokes.length; sIdx++) {
        const s = cluster.strokes[sIdx];
        for (let j = 0; j < s.points.length - 1; j++) {
          const cp = closestPointOnSegment(pt, s.points[j], s.points[j + 1]);
          const d = Math.hypot(pt.x - cp.x, pt.y - cp.y);
          if (d < bestDist) {
            bestDist = d;
            bestSnap = cp;
            bestStrokeId = s.id;
          }
        }
      }

      if (bestStrokeId && bestDist <= snapTolerance * 1.5) {
        boundStrokeSet.add(bestStrokeId);
      }

      if (bestSnap && bestDist <= snapTolerance) {
        return {
          x: Math.round(bestSnap.x * 10) / 10,
          y: Math.round(bestSnap.y * 10) / 10,
        };
      }

      return {
        x: Math.round(pt.x * 10) / 10,
        y: Math.round(pt.y * 10) / 10,
      };
    });

    if (snappedContour.length < 3 || polygonArea(snappedContour) < 20) {
      continue;
    }

    const boundStrokeIds =
      boundStrokeSet.size > 0
        ? Array.from(boundStrokeSet)
        : [cluster.strokes[cluster.strokes.length - 1].id];

    // Pick topmost bounding stroke in render order as ownerStrokeId
    let ownerStrokeId = boundStrokeIds[boundStrokeIds.length - 1];
    for (let i = cluster.strokes.length - 1; i >= 0; i--) {
      if (boundStrokeSet.has(cluster.strokes[i].id)) {
        ownerStrokeId = cluster.strokes[i].id;
        break;
      }
    }

    return {
      ownerStrokeId,
      boundStrokeIds,
      points: snappedContour,
      isSmoothCurve: false,
    };
  }

  return null;
}
