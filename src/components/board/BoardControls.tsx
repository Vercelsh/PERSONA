import React from 'react';
import { BoardImageObject, BoardTextObject, BoardStroke, BoardShapeObject, BoardPoint, SelectedItem } from '../../types';
import { Trash2 } from 'lucide-react';

interface BoardControlsProps {
  selectedItems: SelectedItem[];
  images: BoardImageObject[];
  texts: BoardTextObject[];
  strokes: BoardStroke[];
  shapes?: BoardShapeObject[];
  editingTextId?: string | null;
  zoom: number;
  viewportX: number;
  viewportY: number;
  onUpdateImage: (updated: BoardImageObject, isFinal?: boolean) => void;
  onUpdateTextPos: (id: string, x: number, y: number, isFinal?: boolean) => void;
  onUpdateStrokePoints: (id: string, points: BoardPoint[], isFinal?: boolean) => void;
  onUpdateShape?: (updated: BoardShapeObject, isFinal?: boolean) => void;
  onUpdateMultipleAbsolute: (
    updatedImages: { id: string; x: number; y: number }[],
    updatedTexts: { id: string; x: number; y: number; width?: number; height?: number; fontSize?: number }[],
    updatedStrokes: { id: string; points: BoardPoint[] }[],
    updatedShapes?: { id: string; x: number; y: number; width?: number; height?: number }[],
    isFinal?: boolean
  ) => void;
  onDeleteSelected: () => void;
  onEditText?: (id: string) => void;
  onCommitHistory?: () => void;
}

export const BoardControls: React.FC<BoardControlsProps> = ({
  selectedItems,
  images,
  texts,
  strokes,
  shapes = [],
  editingTextId,
  zoom,
  viewportX,
  viewportY,
  onUpdateImage,
  onUpdateTextPos,
  onUpdateStrokePoints,
  onUpdateShape,
  onUpdateMultipleAbsolute,
  onDeleteSelected,
  onEditText,
  onCommitHistory,
}) => {
  if (selectedItems.length === 0) return null;

  // "Линии + фото = фото НЕ входит в группу. При групповом выделении линий фотография должна полностью игнорироваться"
  const hasStrokesInSelection = selectedItems.some((i) => i.type === 'stroke');
  const activeSelectedItems = hasStrokesInSelection
    ? selectedItems.filter((i) => i.type !== 'image')
    : selectedItems;

  if (activeSelectedItems.length === 0) return null;

  const singleItem = activeSelectedItems.length === 1 ? activeSelectedItems[0] : null;
  const isMultiple = activeSelectedItems.length > 1;

  const currentImage = singleItem?.type === 'image' ? images.find((i) => i.id === singleItem.id) || null : null;
  const currentStroke = singleItem?.type === 'stroke' ? strokes.find((s) => s.id === singleItem.id) || null : null;
  const currentShape = singleItem?.type === 'shape' ? shapes.find((s) => s.id === singleItem.id) || null : null;

  // Rock-solid gesture handler attached dynamically per gesture
  const startInteraction = (mode: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const initialImage = currentImage ? { ...currentImage } : null;
    const initialStroke = currentStroke ? { ...currentStroke, points: currentStroke.points.map((p) => ({ ...p })) } : null;
    const initialShape = currentShape ? { ...currentShape } : null;

    let initialStrokeMinX = Infinity,
      initialStrokeMinY = Infinity,
      initialStrokeMaxX = -Infinity,
      initialStrokeMaxY = -Infinity;
    if (initialStroke && initialStroke.points.length > 0) {
      for (const p of initialStroke.points) {
        if (p.x < initialStrokeMinX) initialStrokeMinX = p.x;
        if (p.x > initialStrokeMaxX) initialStrokeMaxX = p.x;
        if (p.y < initialStrokeMinY) initialStrokeMinY = p.y;
        if (p.y > initialStrokeMaxY) initialStrokeMaxY = p.y;
      }
    }
    const initialStrokePadding = (initialStroke ? initialStroke.width : 2) / 2 + 4;
    const strokeOriginX = initialStrokeMinX - initialStrokePadding;
    const strokeOriginY = initialStrokeMinY - initialStrokePadding;
    const strokeInitialW = Math.max(16, initialStrokeMaxX - initialStrokeMinX + initialStrokePadding * 2);
    const strokeInitialH = Math.max(16, initialStrokeMaxY - initialStrokeMinY + initialStrokePadding * 2);

    // Center in screen coords for smooth rotation
    const centerX = initialImage ? initialImage.x + initialImage.width / 2 : 0;
    const centerY = initialImage ? initialImage.y + initialImage.height / 2 : 0;
    const screenCenterX = centerX * zoom + viewportX;
    const screenCenterY = centerY * zoom + viewportY;

    const initialPointerAngle = Math.atan2(startClientY - screenCenterY, startClientX - screenCenterX);
    const initialImageRotation = initialImage?.rotation || 0;

    const initialImages = activeSelectedItems
      .filter((i) => i.type === 'image')
      .map((i) => {
        const img = images.find((im) => im.id === i.id);
        return { id: i.id, x: img?.x || 0, y: img?.y || 0 };
      });
    const initialTexts = activeSelectedItems
      .filter((i) => i.type === 'text')
      .map((i) => {
        const txt = texts.find((t) => t.id === i.id);
        return { id: i.id, x: txt?.x || 0, y: txt?.y || 0 };
      });
    const initialShapes = activeSelectedItems
      .filter((i) => i.type === 'shape')
      .map((i) => {
        const shp = shapes.find((s) => s.id === i.id);
        return { id: i.id, x: shp?.x || 0, y: shp?.y || 0, width: shp?.width || 120, height: shp?.height || 120 };
      });
    const initialStrokes = activeSelectedItems
      .filter((i) => i.type === 'stroke')
      .map((i) => {
        const s = strokes.find((st) => st.id === i.id);
        return { id: i.id, points: s ? s.points.map((p) => ({ ...p })) : [] };
      });

    let groupMinX = Infinity,
      groupMinY = Infinity,
      groupMaxX = -Infinity,
      groupMaxY = -Infinity;

    for (const s of initialStrokes) {
      const strokeObj = strokes.find((st) => st.id === s.id);
      const halfW = (strokeObj ? strokeObj.width : 2) / 2;
      for (const p of s.points) {
        if (p.x - halfW < groupMinX) groupMinX = p.x - halfW;
        if (p.x + halfW > groupMaxX) groupMaxX = p.x + halfW;
        if (p.y - halfW < groupMinY) groupMinY = p.y - halfW;
        if (p.y + halfW > groupMaxY) groupMaxY = p.y + halfW;
      }
    }
    for (const txt of initialTexts) {
      const txtObj = texts.find((t) => t.id === txt.id);
      if (txtObj) {
        const w = txtObj.width || Math.max(80, txtObj.text.length * (txtObj.fontSize * 0.6) + 20);
        const h = txtObj.height || Math.max(28, txtObj.fontSize * 1.5);
        groupMinX = Math.min(groupMinX, txt.x);
        groupMinY = Math.min(groupMinY, txt.y);
        groupMaxX = Math.max(groupMaxX, txt.x + w);
        groupMaxY = Math.max(groupMaxY, txt.y + h);
      }
    }
    for (const shp of initialShapes) {
      groupMinX = Math.min(groupMinX, shp.x);
      groupMinY = Math.min(groupMinY, shp.y);
      groupMaxX = Math.max(groupMaxX, shp.x + shp.width);
      groupMaxY = Math.max(groupMaxY, shp.y + shp.height);
    }
    for (const img of initialImages) {
      const imgObj = images.find((i) => i.id === img.id);
      if (imgObj) {
        groupMinX = Math.min(groupMinX, img.x);
        groupMinY = Math.min(groupMinY, img.y);
        groupMaxX = Math.max(groupMaxX, img.x + imgObj.width);
        groupMaxY = Math.max(groupMaxY, img.y + imgObj.height);
      }
    }

    const multiPadding = 6;
    const groupOriginX = groupMinX - multiPadding;
    const groupOriginY = groupMinY - multiPadding;
    const groupInitialW = Math.max(20, groupMaxX - groupMinX + multiPadding * 2);
    const groupInitialH = Math.max(20, groupMaxY - groupMinY + multiPadding * 2);

    let hasMoved = false;

    const onPointerMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClientX) / zoom;
      const dy = (ev.clientY - startClientY) / zoom;

      if (Math.hypot(dx, dy) > 1.5) {
        hasMoved = true;
      }

      // 1. Move Single Image
      if (mode === 'move-image' && initialImage) {
        onUpdateImage(
          {
            ...initialImage,
            x: Math.round(initialImage.x + dx),
            y: Math.round(initialImage.y + dy),
          },
          false
        );
      }
      // 1b. Move Single Shape
      else if (mode === 'move-shape' && initialShape) {
        onUpdateShape?.(
          {
            ...initialShape,
            x: Math.round(initialShape.x + dx),
            y: Math.round(initialShape.y + dy),
          },
          false
        );
      }
      // 2. Move Single Stroke
      else if (mode === 'move-stroke' && initialStroke) {
        const newPoints = initialStroke.points.map((p) => ({
          x: Math.round(p.x + dx),
          y: Math.round(p.y + dy),
        }));
        onUpdateStrokePoints(initialStroke.id, newPoints, false);
      }
      // 2b. Resize Single Stroke via single bottom-right handle (freely in all directions, crossing origin allowed)
      else if (mode === 'resize-stroke' && initialStroke && initialStroke.points.length > 0) {
        let scaleX = strokeInitialW > 0.001 ? (strokeInitialW + dx) / strokeInitialW : 1;
        let scaleY = strokeInitialH > 0.001 ? (strokeInitialH + dy) / strokeInitialH : 1;

        if (ev.shiftKey && strokeInitialW > 0.001 && strokeInitialH > 0.001) {
          if (Math.abs(dx) > Math.abs(dy)) {
            scaleY = Math.sign(scaleY || 1) * Math.abs(scaleX);
          } else {
            scaleX = Math.sign(scaleX || 1) * Math.abs(scaleY);
          }
        }

        const newPoints = initialStroke.points.map((p) => ({
          x: Math.round((strokeOriginX + (p.x - strokeOriginX) * scaleX) * 10) / 10,
          y: Math.round((strokeOriginY + (p.y - strokeOriginY) * scaleY) * 10) / 10,
        }));

        onUpdateStrokePoints(initialStroke.id, newPoints, false);
      }
      // 2c. Resize Single Shape via single bottom-right handle (1:1 cursor binding)
      else if (mode === 'resize-shape' && initialShape) {
        let targetW = Math.max(16, Math.round(initialShape.width + dx));
        let targetH = Math.max(16, Math.round(initialShape.height + dy));

        const isAspectLocked = initialShape.type === 'square' || initialShape.type === 'circle';
        if (isAspectLocked) {
          const maxDim = Math.max(16, Math.max(targetW, targetH));
          targetW = maxDim;
          targetH = maxDim;
        }

        onUpdateShape?.(
          {
            ...initialShape,
            width: targetW,
            height: targetH,
          },
          false
        );
      }
      // 3. Move Multiple Objects
      else if (mode === 'move-multi') {
        const updatedImages = initialImages.map((i) => ({
          id: i.id,
          x: Math.round(i.x + dx),
          y: Math.round(i.y + dy),
        }));
        const updatedTexts = initialTexts.map((t) => ({
          id: t.id,
          x: Math.round(t.x + dx),
          y: Math.round(t.y + dy),
        }));
        const updatedShapes = initialShapes.map((s) => ({
          id: s.id,
          x: Math.round(s.x + dx),
          y: Math.round(s.y + dy),
        }));
        const updatedStrokes = initialStrokes.map((s) => ({
          id: s.id,
          points: s.points.map((p) => ({ x: Math.round(p.x + dx), y: Math.round(p.y + dy) })),
        }));

        onUpdateMultipleAbsolute(updatedImages, updatedTexts, updatedStrokes, updatedShapes, false);
      }
      // 3b. Resize Group via single bottom-right handle (freely in all directions, crossing origin allowed)
      else if (mode.startsWith('resize-multi') && (initialStrokes.length > 0 || initialTexts.length > 0 || initialShapes.length > 0)) {
        let scaleX = groupInitialW > 0.001 ? (groupInitialW + dx) / groupInitialW : 1;
        let scaleY = groupInitialH > 0.001 ? (groupInitialH + dy) / groupInitialH : 1;

        if (ev.shiftKey && groupInitialW > 0.001 && groupInitialH > 0.001) {
          if (Math.abs(dx) > Math.abs(dy)) {
            scaleY = Math.sign(scaleY || 1) * Math.abs(scaleX);
          } else {
            scaleX = Math.sign(scaleX || 1) * Math.abs(scaleY);
          }
        }

        const updatedStrokes = initialStrokes.map((s) => ({
          id: s.id,
          points: s.points.map((p) => ({
            x: Math.round((groupOriginX + (p.x - groupOriginX) * scaleX) * 10) / 10,
            y: Math.round((groupOriginY + (p.y - groupOriginY) * scaleY) * 10) / 10,
          })),
        }));

        const updatedTexts = initialTexts.map((t) => {
          const txtObj = texts.find((tx) => tx.id === t.id);
          const origW = txtObj?.width || 120;
          const origH = txtObj?.height || 36;
          const origFont = txtObj?.fontSize || 18;
          const newW = Math.max(30, Math.round(origW * Math.abs(scaleX)));
          const newH = Math.max(20, Math.round(origH * Math.abs(scaleY)));
          const targetX = groupOriginX + (t.x - groupOriginX) * scaleX;
          const targetY = groupOriginY + (t.y - groupOriginY) * scaleY;
          return {
            id: t.id,
            x: Math.round(scaleX >= 0 ? targetX : targetX - newW),
            y: Math.round(scaleY >= 0 ? targetY : targetY - newH),
            width: newW,
            height: newH,
            fontSize: origFont, // Fixed font size, never auto-scaled
          };
        });

        const updatedShapes = initialShapes.map((s) => {
          const newW = Math.max(16, Math.round(s.width * Math.abs(scaleX)));
          const newH = Math.max(16, Math.round(s.height * Math.abs(scaleY)));
          const targetX = groupOriginX + (s.x - groupOriginX) * scaleX;
          const targetY = groupOriginY + (s.y - groupOriginY) * scaleY;
          return {
            id: s.id,
            x: Math.round(scaleX >= 0 ? targetX : targetX - newW),
            y: Math.round(scaleY >= 0 ? targetY : targetY - newH),
            width: newW,
            height: newH,
          };
        });

        onUpdateMultipleAbsolute([], updatedTexts, updatedStrokes, updatedShapes, false);
      }
      // 4. Resize Image (Handle tracks cursor 1:1)
      else if (mode.startsWith('resize-') && initialImage) {
        const handle = mode.replace('resize-', '');
        let newW = initialImage.width;
        let newH = initialImage.height;
        let newX = initialImage.x;
        let newY = initialImage.y;

        if (handle === 'se') {
          newW = Math.max(30, Math.round(initialImage.width + dx));
          newH = Math.max(30, Math.round(initialImage.height + dy));
          if (ev.shiftKey) {
            const s = Math.max(newW / initialImage.width, newH / initialImage.height);
            newW = Math.round(initialImage.width * s);
            newH = Math.round(initialImage.height * s);
          }
        } else if (handle === 'sw') {
          newW = Math.max(30, Math.round(initialImage.width - dx));
          newH = Math.max(30, Math.round(initialImage.height + dy));
          if (ev.shiftKey) {
            const s = Math.max(newW / initialImage.width, newH / initialImage.height);
            newW = Math.round(initialImage.width * s);
            newH = Math.round(initialImage.height * s);
          }
          newX = initialImage.x + (initialImage.width - newW);
        } else if (handle === 'ne') {
          newW = Math.max(30, Math.round(initialImage.width + dx));
          newH = Math.max(30, Math.round(initialImage.height - dy));
          if (ev.shiftKey) {
            const s = Math.max(newW / initialImage.width, newH / initialImage.height);
            newW = Math.round(initialImage.width * s);
            newH = Math.round(initialImage.height * s);
          }
          newY = initialImage.y + (initialImage.height - newH);
        } else if (handle === 'nw') {
          newW = Math.max(30, Math.round(initialImage.width - dx));
          newH = Math.max(30, Math.round(initialImage.height - dy));
          if (ev.shiftKey) {
            const s = Math.max(newW / initialImage.width, newH / initialImage.height);
            newW = Math.round(initialImage.width * s);
            newH = Math.round(initialImage.height * s);
          }
          newX = initialImage.x + (initialImage.width - newW);
          newY = initialImage.y + (initialImage.height - newH);
        } else if (handle === 'e') {
          newW = Math.max(30, Math.round(initialImage.width + dx));
        } else if (handle === 'w') {
          newW = Math.max(30, Math.round(initialImage.width - dx));
          newX = initialImage.x + (initialImage.width - newW);
        } else if (handle === 's') {
          newH = Math.max(30, Math.round(initialImage.height + dy));
        } else if (handle === 'n') {
          newH = Math.max(30, Math.round(initialImage.height - dy));
          newY = initialImage.y + (initialImage.height - newH);
        }

        onUpdateImage(
          {
            ...initialImage,
            x: Math.round(newX),
            y: Math.round(newY),
            width: Math.round(newW),
            height: Math.round(newH),
          },
          false
        );
      }
      // 6. Smooth Rotation (Continuous Delta without 180° flip)
      else if (mode === 'rotate' && initialImage) {
        const currentPointerAngle = Math.atan2(ev.clientY - screenCenterY, ev.clientX - screenCenterX);
        let deltaRad = currentPointerAngle - initialPointerAngle;
        let deltaDeg = (deltaRad * 180) / Math.PI;

        // Normalize delta to [-180, 180]
        while (deltaDeg > 180) deltaDeg -= 360;
        while (deltaDeg < -180) deltaDeg += 360;

        let newRotation = Math.round(initialImageRotation + deltaDeg);
        if (ev.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }

        onUpdateImage(
          {
            ...initialImage,
            rotation: newRotation,
          },
          false
        );
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (hasMoved) {
        onCommitHistory?.();
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // -------------------------------------------------------------
  // MULTIPLE SELECTION BOUNDING BOX
  // -------------------------------------------------------------
  if (isMultiple) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const hasStrokes = activeSelectedItems.some((i) => i.type === 'stroke');

    activeSelectedItems.forEach((item) => {
      if (item.type === 'stroke') {
        const s = strokes.find((st) => st.id === item.id);
        if (s) {
          const halfW = (s.width || 2) / 2;
          s.points.forEach((p) => {
            minX = Math.min(minX, p.x - halfW);
            minY = Math.min(minY, p.y - halfW);
            maxX = Math.max(maxX, p.x + halfW);
            maxY = Math.max(maxY, p.y + halfW);
          });
        }
      } else if (item.type === 'text') {
        const txt = texts.find((t) => t.id === item.id);
        if (txt) {
          const w = txt.width || Math.max(80, txt.text.length * (txt.fontSize * 0.6) + 20);
          const h = txt.height || Math.max(28, txt.fontSize * 1.5);
          minX = Math.min(minX, txt.x);
          minY = Math.min(minY, txt.y);
          maxX = Math.max(maxX, txt.x + w);
          maxY = Math.max(maxY, txt.y + h);
        }
      } else if (item.type === 'shape') {
        const shp = shapes.find((s) => s.id === item.id);
        if (shp) {
          minX = Math.min(minX, shp.x);
          minY = Math.min(minY, shp.y);
          maxX = Math.max(maxX, shp.x + shp.width);
          maxY = Math.max(maxY, shp.y + shp.height);
        }
      } else if (item.type === 'image') {
        if (!hasStrokes) {
          const img = images.find((i) => i.id === item.id);
          if (img) {
            minX = Math.min(minX, img.x);
            minY = Math.min(minY, img.y);
            maxX = Math.max(maxX, img.x + img.width);
            maxY = Math.max(maxY, img.y + img.height);
          }
        }
      }
    });

    if (minX === Infinity) return null;

    const padding = 6;
    const boxX = minX - padding;
    const boxY = minY - padding;
    const boxW = Math.max(20, maxX - minX + padding * 2);
    const boxH = Math.max(20, maxY - minY + padding * 2);

    const screenX = boxX * zoom + viewportX;
    const screenY = boxY * zoom + viewportY;
    const screenW = boxW * zoom;
    const screenH = boxH * zoom;

    const canResizeGroup = hasStrokes || activeSelectedItems.some((i) => i.type === 'text' || i.type === 'shape');

    return (
      <div
        className="absolute pointer-events-none z-30"
        style={{
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
        }}
      >
        <div
          onPointerDown={(e) => startInteraction('move-multi', e)}
          className="absolute inset-0 border-2 border-black border-dashed pointer-events-auto rounded cursor-move bg-black/[0.04]"
        />

        {/* Dedicated Delete Button on Top Right (Neatly positioned above top-right corner) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDeleteSelected();
          }}
          className="absolute -top-8 -right-2 w-5.5 h-5.5 rounded-full bg-black text-white hover:bg-red-600 border border-white flex items-center justify-center pointer-events-auto shadow-md transition-all hover:scale-110 z-50 cursor-pointer"
          title="Удалить выбранные объекты (Delete / Backspace)"
        >
          <Trash2 className="w-3 h-3" />
        </button>

        {/* Single Resize Handle on Bottom Right */}
        {canResizeGroup && (
          <div
            onPointerDown={(e) => startInteraction('resize-multi', e)}
            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-black rounded-full cursor-nwse-resize shadow-sm hover:scale-125 transition-transform z-50 pointer-events-auto"
            title="Изменить размер группы (потяните)"
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // SINGLE IMAGE SELECTION & TRANSFORMATION
  // -------------------------------------------------------------
  if (singleItem?.type === 'image' && currentImage) {
    const screenX = currentImage.x * zoom + viewportX;
    const screenY = currentImage.y * zoom + viewportY;
    const screenW = currentImage.width * zoom;
    const screenH = currentImage.height * zoom;

    return (
      <div
        className="absolute pointer-events-none z-30"
        style={{
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
          transform: `rotate(${currentImage.rotation || 0}deg)`,
          transformOrigin: 'center center',
        }}
      >
        {/* Solid Black Selection Border with drag capability */}
        <div
          onPointerDown={(e) => startInteraction('move-image', e)}
          className="absolute inset-0 border-2 border-black pointer-events-auto rounded-sm cursor-move shadow-[0_0_0_1px_rgba(255,255,255,0.7)]"
        />

        {/* Dedicated Delete Button on Top Right (Separated by 36px from ne resize handle) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDeleteSelected();
          }}
          className="absolute -top-10 -right-2 w-7 h-7 rounded-full bg-black text-white hover:bg-red-600 border-2 border-white flex items-center justify-center pointer-events-auto shadow-xl transition-all hover:scale-110 z-50 cursor-pointer"
          title="Удалить фото (Delete / Backspace)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Rotation Handle (Separated clearly above image center by 46px, with vertical stem) */}
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-40">
          <div
            onPointerDown={(e) => startInteraction('rotate', e)}
            className="w-4 h-4 rounded-full bg-white border-2 border-black hover:scale-125 transition-transform cursor-grab active:cursor-grabbing shadow-lg"
            title="Повернуть фото (Shift = шаг 15°)"
          />
          <div className="w-[1.5px] h-6 bg-black" />
        </div>

        {/* 4 Corner Resize Handles (Keep aspect ratio by default) */}
        <div
          onPointerDown={(e) => startInteraction('resize-nw', e)}
          className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-black rounded-[2px] pointer-events-auto hover:scale-125 transition-transform cursor-nwse-resize shadow-md z-30"
          title="Изменить размер (пропорционально)"
        />
        <div
          onPointerDown={(e) => startInteraction('resize-ne', e)}
          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-black rounded-[2px] pointer-events-auto hover:scale-125 transition-transform cursor-nesw-resize shadow-md z-30"
          title="Изменить размер (пропорционально)"
        />
        <div
          onPointerDown={(e) => startInteraction('resize-sw', e)}
          className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-black rounded-[2px] pointer-events-auto hover:scale-125 transition-transform cursor-nesw-resize shadow-md z-30"
          title="Изменить размер (пропорционально)"
        />
        <div
          onPointerDown={(e) => startInteraction('resize-se', e)}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-black rounded-[2px] pointer-events-auto hover:scale-125 transition-transform cursor-nwse-resize shadow-md z-30"
          title="Изменить размер (пропорционально)"
        />

        {/* 4 Side Resize Handles (Independent width/height) */}
        <div
          onPointerDown={(e) => startInteraction('resize-n', e)}
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-white border border-black rounded-[1px] pointer-events-auto hover:scale-125 transition-transform cursor-ns-resize shadow z-30"
          title="Изменить высоту"
        />
        <div
          onPointerDown={(e) => startInteraction('resize-s', e)}
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-white border border-black rounded-[1px] pointer-events-auto hover:scale-125 transition-transform cursor-ns-resize shadow z-30"
          title="Изменить высоту"
        />
        <div
          onPointerDown={(e) => startInteraction('resize-w', e)}
          className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-4 bg-white border border-black rounded-[1px] pointer-events-auto hover:scale-125 transition-transform cursor-ew-resize shadow z-30"
          title="Изменить ширину"
        />
        <div
          onPointerDown={(e) => startInteraction('resize-e', e)}
          className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-4 bg-white border border-black rounded-[1px] pointer-events-auto hover:scale-125 transition-transform cursor-ew-resize shadow z-30"
          title="Изменить ширину"
        />

        {/* Rotation Indicator Pill */}
        {currentImage.rotation ? (
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black text-[9px] font-mono text-white pointer-events-none shadow">
            {currentImage.rotation}°
          </div>
        ) : null}
      </div>
    );
  }

  // -------------------------------------------------------------
  // SINGLE STROKE SELECTION & CONTROLS
  // -------------------------------------------------------------
  if (singleItem?.type === 'stroke' && currentStroke && currentStroke.points.length > 0) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of currentStroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const padding = currentStroke.width / 2 + 4;
    const boxX = minX - padding;
    const boxY = minY - padding;
    const boxW = Math.max(16, maxX - minX + padding * 2);
    const boxH = Math.max(16, maxY - minY + padding * 2);

    const screenX = boxX * zoom + viewportX;
    const screenY = boxY * zoom + viewportY;
    const screenW = boxW * zoom;
    const screenH = boxH * zoom;

    return (
      <div
        className="absolute pointer-events-none z-30"
        style={{
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
        }}
      >
        <div
          onPointerDown={(e) => startInteraction('move-stroke', e)}
          className="absolute inset-0 border-2 border-black border-dashed pointer-events-auto rounded cursor-move bg-black/[0.04]"
        />

        {/* Dedicated Delete Button on Top Right (Lowered neatly right above frame) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDeleteSelected();
          }}
          className="absolute -top-7 -right-2 w-5.5 h-5.5 rounded-full bg-black text-white hover:bg-red-600 border border-white flex items-center justify-center pointer-events-auto shadow-md transition-all hover:scale-110 z-50 cursor-pointer"
          title="Удалить штрих (Delete / Backspace)"
        >
          <Trash2 className="w-3 h-3" />
        </button>

        {/* Single Resize Handle on Bottom Right */}
        <div
          onPointerDown={(e) => startInteraction('resize-stroke', e)}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-black rounded-full cursor-nwse-resize shadow-sm hover:scale-125 transition-transform z-50 pointer-events-auto"
          title="Изменить размер (потяните)"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // SINGLE SHAPE SELECTION & CONTROLS
  // -------------------------------------------------------------
  if (singleItem?.type === 'shape' && currentShape) {
    const screenX = currentShape.x * zoom + viewportX;
    const screenY = currentShape.y * zoom + viewportY;
    const screenW = currentShape.width * zoom;
    const screenH = currentShape.height * zoom;

    return (
      <div
        className="absolute pointer-events-none z-30"
        style={{
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
        }}
      >
        <div
          onPointerDown={(e) => startInteraction('move-shape', e)}
          className="absolute inset-0 border-2 border-black border-dashed pointer-events-auto rounded cursor-move bg-black/[0.04]"
        />

        {/* Dedicated Delete Button on Top Right (Lowered neatly right above frame) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDeleteSelected();
          }}
          className="absolute -top-7 -right-2 w-5.5 h-5.5 rounded-full bg-black text-white hover:bg-red-600 border border-white flex items-center justify-center pointer-events-auto shadow-md transition-all hover:scale-110 z-50 cursor-pointer"
          title="Удалить фигуру (Delete / Backspace)"
        >
          <Trash2 className="w-3 h-3" />
        </button>

        {/* Single Resize Handle on Bottom Right */}
        <div
          onPointerDown={(e) => startInteraction('resize-shape', e)}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-black rounded-full cursor-nwse-resize shadow-sm hover:scale-125 transition-transform z-50 pointer-events-auto"
          title="Изменить размер (потяните)"
        />
      </div>
    );
  }

  return null;
};
