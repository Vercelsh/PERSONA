import React, { useRef, useEffect } from 'react';
import { BoardPoint, BoardStroke } from '../../types';

interface BoardCanvasProps {
  strokes: BoardStroke[];
  currentStroke: BoardStroke | null;
  viewportX: number;
  viewportY: number;
  zoom: number;
  width: number;
  height: number;
  eraserPreview: { x: number; y: number; radius: number } | null;
  marqueeRect: { startX: number; startY: number; currentX: number; currentY: number } | null;
  zIndex?: number;
}

export const BoardCanvas: React.FC<BoardCanvasProps> = ({
  strokes,
  currentStroke,
  viewportX,
  viewportY,
  zoom,
  width,
  height,
  eraserPreview,
  marqueeRect,
  zIndex = 10,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Handle high DPI crisp rendering without reallocating backing buffer when dimensions are unchanged
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.max(1, Math.round(width * dpr));
    const targetH = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // Apply viewport camera transform for world-space items
    ctx.translate(viewportX, viewportY);
    ctx.scale(zoom, zoom);

    const tracePolygonPath = (
      targetCtx: CanvasRenderingContext2D,
      pts: BoardPoint[],
      isSmoothCurve?: boolean
    ) => {
      if (!pts || pts.length < 3) return;
      targetCtx.beginPath();
      targetCtx.moveTo(pts[0].x, pts[0].y);

      if (isSmoothCurve) {
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          targetCtx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        const last = pts[pts.length - 1];
        targetCtx.lineTo(last.x, last.y);
      } else {
        for (let i = 1; i < pts.length; i++) {
          targetCtx.lineTo(pts[i].x, pts[i].y);
        }
      }

      targetCtx.closePath();
    };

    // Helper to render a stroke's interior fill regions (with support for partial area-eraser cutouts)
    const renderStrokeFill = (stroke: BoardStroke) => {
      const regions = stroke.fillPolygons;
      if (!regions || regions.length === 0) return;

      const erased = stroke.erasedFillStrokes;
      if (!erased || erased.length === 0) {
        ctx.globalAlpha = stroke.opacity ?? 1;
        for (let i = 0; i < regions.length; i++) {
          const fp = regions[i];
          if (!fp.points || fp.points.length < 3) continue;
          tracePolygonPath(ctx, fp.points, fp.isSmoothCurve);
          ctx.fillStyle = fp.color;
          ctx.fill();
        }
        return;
      }

      // Compute world bounding box of all fill regions of this stroke
      let fMinX = Infinity;
      let fMinY = Infinity;
      let fMaxX = -Infinity;
      let fMaxY = -Infinity;
      for (let i = 0; i < regions.length; i++) {
        const pts = regions[i].points;
        for (let j = 0; j < pts.length; j++) {
          const p = pts[j];
          if (p.x < fMinX) fMinX = p.x;
          if (p.x > fMaxX) fMaxX = p.x;
          if (p.y < fMinY) fMinY = p.y;
          if (p.y > fMaxY) fMaxY = p.y;
        }
      }
      if (fMinX === Infinity) return;

      // Clamped screen-space bounding box
      const sx0 = Math.max(0, Math.floor(fMinX * zoom + viewportX - 4));
      const sy0 = Math.max(0, Math.floor(fMinY * zoom + viewportY - 4));
      const sx1 = Math.min(width, Math.ceil(fMaxX * zoom + viewportX + 4));
      const sy1 = Math.min(height, Math.ceil(fMaxY * zoom + viewportY + 4));
      const sw = sx1 - sx0;
      const sh = sy1 - sy0;
      if (sw <= 0 || sh <= 0) return;

      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const offCanvas = offscreenCanvasRef.current;
      const targetW = Math.ceil(sw * dpr);
      const targetH = Math.ceil(sh * dpr);
      if (offCanvas.width < targetW) offCanvas.width = targetW;
      if (offCanvas.height < targetH) offCanvas.height = targetH;

      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return;

      offCtx.save();
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.clearRect(0, 0, targetW, targetH);
      offCtx.scale(dpr, dpr);
      offCtx.translate(viewportX - sx0, viewportY - sy0);
      offCtx.scale(zoom, zoom);

      // 1. Draw fill polygons
      for (let i = 0; i < regions.length; i++) {
        const fp = regions[i];
        if (!fp.points || fp.points.length < 3) continue;
        tracePolygonPath(offCtx, fp.points, fp.isSmoothCurve);
        offCtx.fillStyle = fp.color;
        offCtx.fill();
      }

      // 2. Subtract erased paths using destination-out
      offCtx.globalCompositeOperation = 'destination-out';
      offCtx.fillStyle = '#000000';
      offCtx.strokeStyle = '#000000';
      offCtx.lineCap = 'round';
      offCtx.lineJoin = 'round';

      for (let i = 0; i < erased.length; i++) {
        const ep = erased[i];
        const ePts = ep.points;
        if (!ePts || ePts.length === 0) continue;
        if (ePts.length === 1) {
          offCtx.beginPath();
          offCtx.arc(ePts[0].x, ePts[0].y, ep.radius, 0, Math.PI * 2);
          offCtx.fill();
        } else {
          offCtx.beginPath();
          offCtx.lineWidth = ep.radius * 2;
          offCtx.moveTo(ePts[0].x, ePts[0].y);
          for (let j = 1; j < ePts.length; j++) {
            offCtx.lineTo(ePts[j].x, ePts[j].y);
          }
          offCtx.stroke();
        }
      }
      offCtx.restore();

      // 3. Composite masked fill onto the main canvas
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = stroke.opacity ?? 1;
      ctx.drawImage(offCanvas, 0, 0, targetW, targetH, sx0, sy0, sw, sh);
      ctx.restore();
    };

    // Helper to render smooth stroke outline with quadratic curves
    const renderStrokeOutline = (stroke: BoardStroke) => {
      const pts = stroke.points;
      if (!pts || pts.length === 0) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = stroke.opacity ?? 1;

      if (pts.length === 1) {
        ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
        return;
      }

      ctx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }

      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    };

    // Pass 1: Render all stroke fills underneath outlines so contours remain crisp on top
    for (let i = 0; i < strokes.length; i++) {
      renderStrokeFill(strokes[i]);
    }

    // Pass 2: Render all saved stroke outlines
    for (let i = 0; i < strokes.length; i++) {
      renderStrokeOutline(strokes[i]);
    }

    // Render active in-progress drawing stroke
    if (currentStroke) {
      renderStrokeOutline(currentStroke);
    }

    // Render area eraser preview cursor circle if active
    if (eraserPreview) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 1.5 / zoom;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.arc(eraserPreview.x, eraserPreview.y, eraserPreview.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Render selection marquee box in world coordinates
    if (marqueeRect) {
      const x = Math.min(marqueeRect.startX, marqueeRect.currentX);
      const y = Math.min(marqueeRect.startY, marqueeRect.currentY);
      const w = Math.abs(marqueeRect.currentX - marqueeRect.startX);
      const h = Math.abs(marqueeRect.currentY - marqueeRect.startY);

      ctx.beginPath();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [strokes, currentStroke, viewportX, viewportY, zoom, width, height, eraserPreview, marqueeRect]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        zIndex,
      }}
      className="absolute inset-0 pointer-events-none"
    />
  );
};
