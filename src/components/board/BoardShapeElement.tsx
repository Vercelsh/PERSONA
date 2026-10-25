import React from 'react';
import { BoardShapeObject } from '../../types';
import { renderShapeSVG } from './shapeDefinitions';

export interface BoardViewport {
  x: number;
  y: number;
  zoom: number;
}

interface BoardShapeElementProps {
  shape: BoardShapeObject;
  viewport: BoardViewport;
  isInteractive: boolean;
  zIndex?: number;
  onSelect: (e: React.PointerEvent) => void;
}

export const BoardShapeElement: React.FC<BoardShapeElementProps> = ({
  shape,
  viewport,
  isInteractive,
  zIndex,
  onSelect,
}) => {
  // Convert board coordinate (x, y) to screen pixels without distorting small zoomed-out dimensions
  const screenX = shape.x * viewport.zoom + viewport.x;
  const screenY = shape.y * viewport.zoom + viewport.y;
  const screenW = Math.max(1, shape.width * viewport.zoom);
  const screenH = Math.max(1, shape.height * viewport.zoom);
  const rotation = shape.rotation || 0;

  return (
    <div
      onPointerDown={isInteractive ? onSelect : undefined}
      className={`absolute select-none ${
        isInteractive ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{
        left: `${screenX}px`,
        top: `${screenY}px`,
        width: `${screenW}px`,
        height: `${screenH}px`,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
        touchAction: 'none',
        zIndex: zIndex ?? (isInteractive ? 20 : 10),
      }}
      data-board-shape-id={shape.id}
    >
      <div className="w-full h-full pointer-events-none">
        {renderShapeSVG(
          shape.type,
          shape.color,
          '100%',
          '100%',
          shape.strokeWidth || 2.5,
          shape.width,
          shape.height,
          viewport.zoom,
          shape.fillColor,
          shape.faceFills,
          shape.erasedFillStrokes,
          shape.id
        )}
      </div>
    </div>
  );
};
