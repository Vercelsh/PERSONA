import React, { useRef, useEffect } from 'react';
import { BoardStroke } from '../../types';

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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Handle high DPI crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // Apply viewport camera transform for world-space items
    ctx.translate(viewportX, viewportY);
    ctx.scale(zoom, zoom);

    // Helper to render smooth stroke with quadratic curves
    const renderStroke = (stroke: BoardStroke) => {
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

    // Render all saved strokes
    for (let i = 0; i < strokes.length; i++) {
      renderStroke(strokes[i]);
    }

    // Render active in-progress drawing stroke
    if (currentStroke) {
      renderStroke(currentStroke);
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
      }}
      className="absolute inset-0 pointer-events-none z-10"
    />
  );
};
