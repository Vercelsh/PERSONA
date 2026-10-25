import React, { useState, useEffect } from 'react';
import { BoardImageObject } from '../../types';
import { getFileAttachment } from '../../lib/db';

interface BoardImageElementProps {
  image: BoardImageObject;
  isSelected: boolean;
  zoom: number;
  viewportX: number;
  viewportY: number;
  isEraserActive?: boolean;
  zIndex?: number;
  onSelect: (e: React.PointerEvent) => void;
}

export const BoardImageElement: React.FC<BoardImageElementProps> = ({
  image,
  isSelected,
  zoom,
  viewportX,
  viewportY,
  isEraserActive = false,
  zIndex,
  onSelect,
}) => {
  const [src, setSrc] = useState<string | null>(image.dataUrl || null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (image.fileId && !image.dataUrl) {
      getFileAttachment(image.fileId).then((file) => {
        if (!active || !file) return;
        createdUrl = URL.createObjectURL(file.blob);
        setSrc(createdUrl);
      }).catch((err) => {
        console.error('Failed to load board image from DB:', err);
      });
    }

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [image.fileId, image.dataUrl]);

  const screenX = image.x * zoom + viewportX;
  const screenY = image.y * zoom + viewportY;
  const screenW = image.width * zoom;
  const screenH = image.height * zoom;

  return (
    <div
      onPointerDown={isEraserActive ? undefined : onSelect}
      className={`absolute select-none ${
        isEraserActive
          ? 'pointer-events-none'
          : 'group cursor-pointer transition-shadow'
      }`}
      style={{
        left: screenX,
        top: screenY,
        width: screenW,
        height: screenH,
        transform: `rotate(${image.rotation || 0}deg)`,
        transformOrigin: 'center center',
        zIndex: zIndex ?? (isSelected ? 10 : 0),
      }}
    >
      {src ? (
        <img
          src={src}
          alt="Вложение доски"
          className="w-full h-full object-fill pointer-events-none rounded shadow-sm"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-neutral-100 border border-neutral-300 rounded text-neutral-400 text-xs font-mono">
          Загрузка фото...
        </div>
      )}
    </div>
  );
};
