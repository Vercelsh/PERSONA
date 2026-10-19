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
  onSelect: (e: React.PointerEvent) => void;
}

export const BoardShapeElement: React.FC<BoardShapeElementProps> = ({
  shape,
  viewport,
  isInteractive,
  onSelect,
}) => {
  // Convert board coordinate (x, y) to screen pixels
  const screenX = shape.x * viewport.zoom + viewport.x;
  const screenY = shape.y * viewport.zoom + viewport.y;
  const screenW = Math.max(10, shape.width * viewport.zoom);
  const screenH = Math.max(10, shape.height * viewport.zoom);

  return (
    <div
      onPointerDown={isInteractive ? onSelect : undefined}
      className={`absolute select-none ${
        isInteractive ? 'cursor-pointer pointer-events-auto z-20' : 'pointer-events-none z-10'
      }`}
      style={{
        left: `${screenX}px`,
        top: `${screenY}px`,
        width: `${screenW}px`,
        height: `${screenH}px`,
        touchAction: 'none',
      }}
      data-board-shape-id={shape.id}
    >
      <div className="w-full h-full pointer-events-none">
        {renderShapeSVG(shape.type, shape.color, '100%', '100%', shape.strokeWidth || 2.5)}
      </div>
    </div>
  );
};
