import React from 'react';
import {
  BoardImageObject,
  BoardTextObject,
  BoardStroke,
  BoardShapeObject,
  BoardPoint,
  SelectedItem,
  StrokeFillRegion,
  StrokeErasedPath,
} from '../../types';
import { getStrokeFullBounds, mapStrokeGeometry } from './fillUtils';
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
  onUpdateStrokePoints: (
    id: string,
    points: BoardPoint[],
    isFinal?: boolean,
    fillPolygons?: StrokeFillRegion[],
    erasedFillStrokes?: StrokeErasedPath[]
  ) => void;
  onUpdateShape?: (updated: BoardShapeObject, isFinal?: boolean) => void;
  onUpdateMultipleAbsolute: (
    updatedImages: { id: string; x: number; y: number }[],
    updatedTexts: { id: string; x: number; y: number; width?: number; height?: number; fontSize?: number }[],
    updatedStrokes: {
      id: string;
      points: BoardPoint[];
      fillPolygons?: StrokeFillRegion[];
      erasedFillStrokes?: StrokeErasedPath[];
    }[],
    updatedShapes?: { id: string; x: number; y: number; width?: number; height?: number }[],
    isFinal?: boolean
  ) => void;
  onDeleteSelected: () => void;
  onEditText?: (id: string) => void;
  onCommitHistory?: () => void;
  onTrySelectHigherObject?: (e: React.PointerEvent) => boolean;
  zIndex?: number;
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
  onTrySelectHigherObject,
  zIndex = 30,
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
    if (
      (mode === 'move-image' || mode === 'move-stroke' || mode === 'move-shape') &&
      onTrySelectHigherObject &&
      onTrySelectHigherObject(e)
    ) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const initialImage = currentImage ? { ...currentImage } : null;
    const initialStroke = currentStroke
      ? {
          ...currentStroke,
          points:
            mode === 'resize-stroke' && currentStroke.points.length === 1
              ? [{ ...currentStroke.points[0] }, { ...currentStroke.points[0] }]
              : currentStroke.points.map((p) => ({ ...p })),
          fillPolygons: currentStroke.fillPolygons
            ? currentStroke.fillPolygons.map((fp) => ({
                ...fp,
                points: fp.points.map((p) => ({ ...p })),
              }))
            : undefined,
          erasedFillStrokes: currentStroke.erasedFillStrokes
            ? currentStroke.erasedFillStrokes.map((ep) => ({
                ...ep,
                points: ep.points.map((p) => ({ ...p })),
              }))
            : undefined,
        }
      : null;
    const initialShape = currentShape ? { ...currentShape } : null;

    let initialStrokeMinX = Infinity,
      initialStrokeMinY = Infinity,
      initialStrokeMaxX = -Infinity,
      initialStrokeMaxY = -Infinity;
    if (initialStroke) {
      const b = getStrokeFullBounds(initialStroke);
      initialStrokeMinX = b.minX;
      initialStrokeMinY = b.minY;
      initialStrokeMaxX = b.maxX;
      initialStrokeMaxY = b.maxY;
    }
    const initialStrokeSpanX =
      initialStrokeMinX !== Infinity ? Math.max(0, initialStrokeMaxX - initialStrokeMinX) : 0;
    const initialStrokeSpanY =
      initialStrokeMinY !== Infinity ? Math.max(0, initialStrokeMaxY - initialStrokeMinY) : 0;

    // Convert shape and image centers from board coordinates to window client coordinates (matching e.clientX / e.clientY)
    const viewportEl = (e.currentTarget as HTMLElement).closest('.board-viewport');
    const viewportRect = viewportEl ? viewportEl.getBoundingClientRect() : null;
    const viewportOffsetX = viewportRect ? viewportRect.left : 0;
    const viewportOffsetY = viewportRect ? viewportRect.top : 0;

    const centerX = initialImage ? initialImage.x + initialImage.width / 2 : 0;
    const centerY = initialImage ? initialImage.y + initialImage.height / 2 : 0;
    const screenCenterX = viewportOffsetX + centerX * zoom + viewportX;
    const screenCenterY = viewportOffsetY + centerY * zoom + viewportY;

    const initialPointerAngle = Math.atan2(startClientY - screenCenterY, startClientX - screenCenterX);
    const initialImageRotation = initialImage?.rotation || 0;

    // Exact center of the shape in window client coordinates (matches CSS transformOrigin: 'center center')
    const shapeScreenX = initialShape ? initialShape.x * zoom + viewportX : 0;
    const shapeScreenY = initialShape ? initialShape.y * zoom + viewportY : 0;
    const shapeScreenW = initialShape ? Math.max(1, initialShape.width * zoom) : 0;
    const shapeScreenH = initialShape ? Math.max(1, initialShape.height * zoom) : 0;
    const shapeClientCenterX = viewportOffsetX + shapeScreenX + shapeScreenW / 2;
    const shapeClientCenterY = viewportOffsetY + shapeScreenY + shapeScreenH / 2;

    const initialShapePointerAngle = Math.atan2(
      startClientY - shapeClientCenterY,
      startClientX - shapeClientCenterX
    );
    const initialShapeRotation = initialShape?.rotation || 0;
    let lastShapePointerAngle = initialShapePointerAngle;
    let shapeRotationTurns = 0;

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
        return {
          id: i.id,
          x: shp?.x || 0,
          y: shp?.y || 0,
          width: shp?.width || 120,
          height: shp?.height || 120,
          rotation: shp?.rotation || 0,
        };
      });
    const initialStrokes = activeSelectedItems
      .filter((i) => i.type === 'stroke')
      .map((i) => {
        const s = strokes.find((st) => st.id === i.id);
        return {
          id: i.id,
          points: s ? s.points.map((p) => ({ ...p })) : [],
          fillPolygons: s?.fillPolygons
            ? s.fillPolygons.map((fp) => ({
                ...fp,
                points: fp.points.map((p) => ({ ...p })),
              }))
            : undefined,
          erasedFillStrokes: s?.erasedFillStrokes
            ? s.erasedFillStrokes.map((ep) => ({
                ...ep,
                points: ep.points.map((p) => ({ ...p })),
              }))
            : undefined,
        };
      });

    let groupMinX = Infinity,
      groupMinY = Infinity,
      groupMaxX = -Infinity,
      groupMaxY = -Infinity;

    for (const s of initialStrokes) {
      const strokeObj = strokes.find((st) => st.id === s.id);
      if (strokeObj) {
        const b = getStrokeFullBounds(strokeObj);
        if (b.minX !== Infinity) {
          groupMinX = Math.min(groupMinX, b.minX);
          groupMinY = Math.min(groupMinY, b.minY);
          groupMaxX = Math.max(groupMaxX, b.maxX);
          groupMaxY = Math.max(groupMaxY, b.maxY);
        }
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
      const cx = shp.x + shp.width / 2;
      const cy = shp.y + shp.height / 2;
      const rad = ((shp.rotation || 0) * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const halfW = (shp.width * cos + shp.height * sin) / 2;
      const halfH = (shp.width * sin + shp.height * cos) / 2;
      groupMinX = Math.min(groupMinX, cx - halfW);
      groupMinY = Math.min(groupMinY, cy - halfH);
      groupMaxX = Math.max(groupMaxX, cx + halfW);
      groupMaxY = Math.max(groupMaxY, cy + halfH);
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

    const groupSpanX = groupMinX !== Infinity ? Math.max(0, groupMaxX - groupMinX) : 0;
    const groupSpanY = groupMinY !== Infinity ? Math.max(0, groupMaxY - groupMinY) : 0;

    let hasMoved = false;

    const onPointerMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClientX) / zoom;
      const dy = (ev.clientY - startClientY) / zoom;

      if (Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) > 1.5 || Math.hypot(dx, dy) > 1.5) {
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
        const mapped = mapStrokeGeometry(
          initialStroke,
          (p) => ({
            x: Math.round((p.x + dx) * 100) / 100,
            y: Math.round((p.y + dy) * 100) / 100,
          }),
          1
        );
        onUpdateStrokePoints(
          initialStroke.id,
          mapped.points,
          false,
          mapped.fillPolygons,
          mapped.erasedFillStrokes
        );
      }
      // 2b. Resize Single Stroke via single bottom-right handle (1:1 handle tracking in all directions)
      else if (
        mode === 'resize-stroke' &&
        initialStroke &&
        (initialStroke.points.length > 0 || (initialStroke.fillPolygons && initialStroke.fillPolygons.length > 0))
      ) {
        let targetSpanX = initialStrokeSpanX + dx;
        let targetSpanY = initialStrokeSpanY + dy;

        if (ev.shiftKey) {
          const baseW = Math.max(1, initialStrokeSpanX);
          const baseH = Math.max(1, initialStrokeSpanY);
          const ratioX = targetSpanX / baseW;
          const ratioY = targetSpanY / baseH;
          if (Math.abs(dx) > Math.abs(dy)) {
            targetSpanY = (Math.sign(targetSpanY) || 1) * Math.abs(ratioX) * baseH;
          } else {
            targetSpanX = (Math.sign(targetSpanX) || 1) * Math.abs(ratioY) * baseW;
          }
        }

        const scaleXForRadius =
          initialStrokeSpanX > 1 ? Math.abs(targetSpanX) / initialStrokeSpanX : 1;
        const scaleYForRadius =
          initialStrokeSpanY > 1 ? Math.abs(targetSpanY) / initialStrokeSpanY : 1;
        const radiusScale = Math.max(0.1, (scaleXForRadius + scaleYForRadius) / 2);

        const totalOutlinePts = initialStroke.points.length;
        const mapPointWithIndex = (p: BoardPoint, idx: number, count: number): BoardPoint => {
          let uX: number;
          if (initialStrokeSpanX > 1e-5) {
            uX = (p.x - initialStrokeMinX) / initialStrokeSpanX;
          } else if (initialStrokeSpanY > 1e-5) {
            uX = (p.y - initialStrokeMinY) / initialStrokeSpanY;
          } else {
            uX = idx / Math.max(1, count - 1);
          }

          let uY: number;
          if (initialStrokeSpanY > 1e-5) {
            uY = (p.y - initialStrokeMinY) / initialStrokeSpanY;
          } else if (initialStrokeSpanX > 1e-5) {
            uY = (p.x - initialStrokeMinX) / initialStrokeSpanX;
          } else {
            uY = idx / Math.max(1, count - 1);
          }

          return {
            x: initialStrokeMinX + uX * targetSpanX,
            y: initialStrokeMinY + uY * targetSpanY,
          };
        };

        const mappedPoints = initialStroke.points.map((p, idx) =>
          mapPointWithIndex(p, idx, totalOutlinePts)
        );
        const mappedFillPolygons = initialStroke.fillPolygons
          ? initialStroke.fillPolygons.map((fp) => ({
              ...fp,
              points: fp.points.map((p, idx) => mapPointWithIndex(p, idx, fp.points.length)),
            }))
          : undefined;
        const mappedErasedFillStrokes = initialStroke.erasedFillStrokes
          ? initialStroke.erasedFillStrokes.map((ep) => ({
              ...ep,
              points: ep.points.map((p, idx) => mapPointWithIndex(p, idx, ep.points.length)),
              radius: Math.max(1, ep.radius * radiusScale),
            }))
          : undefined;

        onUpdateStrokePoints(
          initialStroke.id,
          mappedPoints,
          false,
          mappedFillPolygons,
          mappedErasedFillStrokes
        );
      }
      // 2c. Resize Single Shape via single bottom-right handle (rotation-aware 1:1 cursor binding)
      else if (mode === 'resize-shape' && initialShape) {
        const rotRad = ((initialShape.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rotRad);
        const sin = Math.sin(rotRad);

        // Project world delta (dx, dy) onto shape's local axes
        const localDx = dx * cos + dy * sin;
        const localDy = -dx * sin + dy * cos;

        const isThinHorizontal =
          initialShape.type === 'line-h' ||
          initialShape.type === 'line-custom' ||
          initialShape.type === 'arrow-right' ||
          initialShape.type === 'arrow-left';
        const isThinVertical =
          initialShape.type === 'line-v' ||
          initialShape.type === 'arrow-up' ||
          initialShape.type === 'arrow-down';

        let targetW = Math.max(16, Math.round(initialShape.width + localDx));
        let targetH = Math.max(16, Math.round(initialShape.height + localDy));

        if (isThinHorizontal && initialShape.type === 'line-custom') {
          targetH = initialShape.height;
        } else if (isThinVertical && initialShape.type === 'line-v') {
          targetW = initialShape.width;
        }

        const isAspectLocked = initialShape.type === 'square' || initialShape.type === 'circle';
        if (isAspectLocked) {
          const maxDim = Math.max(16, Math.max(targetW, targetH));
          targetW = maxDim;
          targetH = maxDim;
        }

        // Keep the top-left corner of the rotated shape anchored in world space while resizing bottom-right
        const dw = targetW - initialShape.width;
        const dh = targetH - initialShape.height;
        const newX = Math.round(initialShape.x + (dw / 2) * (cos - 1) - (dh / 2) * sin);
        const newY = Math.round(initialShape.y + (dw / 2) * sin + (dh / 2) * (cos - 1));

        onUpdateShape?.(
          {
            ...initialShape,
            x: newX,
            y: newY,
            width: targetW,
            height: targetH,
          },
          false
        );
      }
      // 2d. Smooth Rotation of Single Shape
      else if (mode === 'rotate-shape' && initialShape) {
        const vecX = ev.clientX - shapeClientCenterX;
        const vecY = ev.clientY - shapeClientCenterY;

        // Avoid atan2 singularity if pointer passes directly over the exact center pixel
        if (Math.hypot(vecX, vecY) < 4) {
          return;
        }

        const currentPointerAngle = Math.atan2(vecY, vecX);
        const stepDiff = currentPointerAngle - lastShapePointerAngle;
        if (stepDiff > Math.PI) {
          shapeRotationTurns -= 1;
        } else if (stepDiff < -Math.PI) {
          shapeRotationTurns += 1;
        }
        lastShapePointerAngle = currentPointerAngle;

        const totalDeltaRad =
          currentPointerAngle - initialShapePointerAngle + shapeRotationTurns * Math.PI * 2;
        const deltaDeg = (totalDeltaRad * 180) / Math.PI;

        let newRotation = initialShapeRotation + deltaDeg;
        if (ev.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        } else {
          newRotation = Math.round(newRotation * 100) / 100;
        }

        // Normalize angle to (-180, 180]
        while (newRotation > 180) newRotation -= 360;
        while (newRotation <= -180) newRotation += 360;

        onUpdateShape?.(
          {
            ...initialShape,
            rotation: newRotation,
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
        const updatedStrokes = initialStrokes.map((s) =>
          mapStrokeGeometry(
            s,
            (p) => ({
              x: Math.round((p.x + dx) * 100) / 100,
              y: Math.round((p.y + dy) * 100) / 100,
            }),
            1
          )
        );

        onUpdateMultipleAbsolute(updatedImages, updatedTexts, updatedStrokes, updatedShapes, false);
      }
      // 3b. Resize Group via single bottom-right handle (1:1 handle tracking in all directions)
      else if (mode.startsWith('resize-multi') && (initialStrokes.length > 0 || initialTexts.length > 0 || initialShapes.length > 0)) {
        let targetSpanX = groupSpanX + dx;
        let targetSpanY = groupSpanY + dy;

        if (ev.shiftKey) {
          const baseW = Math.max(1, groupSpanX);
          const baseH = Math.max(1, groupSpanY);
          const ratioX = targetSpanX / baseW;
          const ratioY = targetSpanY / baseH;
          if (Math.abs(dx) > Math.abs(dy)) {
            targetSpanY = (Math.sign(targetSpanY) || 1) * Math.abs(ratioX) * baseH;
          } else {
            targetSpanX = (Math.sign(targetSpanX) || 1) * Math.abs(ratioY) * baseW;
          }
        }

        const scaleX = groupSpanX > 1e-5 ? targetSpanX / groupSpanX : 1;
        const scaleY = groupSpanY > 1e-5 ? targetSpanY / groupSpanY : 1;
        const radiusScale = Math.max(0.1, (Math.abs(scaleX) + Math.abs(scaleY)) / 2);

        const updatedStrokes = initialStrokes.map((s) =>
          mapStrokeGeometry(
            s,
            (p) => {
              const uX =
                groupSpanX > 1e-5
                  ? (p.x - groupMinX) / groupSpanX
                  : groupSpanY > 1e-5
                  ? (p.y - groupMinY) / groupSpanY
                  : 0.5;
              const uY =
                groupSpanY > 1e-5
                  ? (p.y - groupMinY) / groupSpanY
                  : groupSpanX > 1e-5
                  ? (p.x - groupMinX) / groupSpanX
                  : 0.5;
              return {
                x: groupMinX + uX * targetSpanX,
                y: groupMinY + uY * targetSpanY,
              };
            },
            radiusScale
          )
        );

        const updatedTexts = initialTexts.map((t) => {
          const txtObj = texts.find((tx) => tx.id === t.id);
          const origW = txtObj?.width || 120;
          const origH = txtObj?.height || 36;
          const origFont = txtObj?.fontSize || 18;
          const newW = Math.max(30, Math.round(origW * Math.abs(scaleX)));
          const newH = Math.max(20, Math.round(origH * Math.abs(scaleY)));
          const targetX = groupMinX + (t.x - groupMinX) * scaleX;
          const targetY = groupMinY + (t.y - groupMinY) * scaleY;
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
          const targetX = groupMinX + (s.x - groupMinX) * scaleX;
          const targetY = groupMinY + (s.y - groupMinY) * scaleY;
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

    let maxStrokeHalfW = 0;
    activeSelectedItems.forEach((item) => {
      if (item.type === 'stroke') {
        const s = strokes.find((st) => st.id === item.id);
        if (s) {
          const halfW = (s.width || 2) / 2;
          if (halfW > maxStrokeHalfW) maxStrokeHalfW = halfW;
          const b = getStrokeFullBounds(s);
          if (b.minX !== Infinity) {
            minX = Math.min(minX, b.minX);
            minY = Math.min(minY, b.minY);
            maxX = Math.max(maxX, b.maxX);
            maxY = Math.max(maxY, b.maxY);
          }
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
          const cx = shp.x + shp.width / 2;
          const cy = shp.y + shp.height / 2;
          const rad = ((shp.rotation || 0) * Math.PI) / 180;
          const cos = Math.abs(Math.cos(rad));
          const sin = Math.abs(Math.sin(rad));
          const halfW = (shp.width * cos + shp.height * sin) / 2;
          const halfH = (shp.width * sin + shp.height * cos) / 2;
          minX = Math.min(minX, cx - halfW);
          minY = Math.min(minY, cy - halfH);
          maxX = Math.max(maxX, cx + halfW);
          maxY = Math.max(maxY, cy + halfH);
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

    const padding = Math.max(6, maxStrokeHalfW + 4);
    const boxX = minX - padding;
    const boxY = minY - padding;
    const boxW = maxX - minX + padding * 2;
    const boxH = maxY - minY + padding * 2;

    const screenX = boxX * zoom + viewportX;
    const screenY = boxY * zoom + viewportY;
    const screenW = boxW * zoom;
    const screenH = boxH * zoom;

    const canResizeGroup = hasStrokes || activeSelectedItems.some((i) => i.type === 'text' || i.type === 'shape');

    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
          zIndex,
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
        className="absolute pointer-events-none"
        style={{
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
          transform: `rotate(${currentImage.rotation || 0}deg)`,
          transformOrigin: 'center center',
          zIndex,
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
  if (
    singleItem?.type === 'stroke' &&
    currentStroke &&
    (currentStroke.points.length > 0 || (currentStroke.fillPolygons && currentStroke.fillPolygons.length > 0))
  ) {
    const b = getStrokeFullBounds(currentStroke);
    const minX = b.minX;
    const minY = b.minY;
    const maxX = b.maxX;
    const maxY = b.maxY;
    if (minX === Infinity) return null;

    const padding = Math.max(6, currentStroke.width / 2 + 4);
    const boxX = minX - padding;
    const boxY = minY - padding;
    const boxW = maxX - minX + padding * 2;
    const boxH = maxY - minY + padding * 2;

    const screenX = boxX * zoom + viewportX;
    const screenY = boxY * zoom + viewportY;
    const screenW = boxW * zoom;
    const screenH = boxH * zoom;

    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
          zIndex,
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
    const screenW = Math.max(1, currentShape.width * zoom);
    const screenH = Math.max(1, currentShape.height * zoom);
    const rotation = currentShape.rotation || 0;

    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          zIndex,
        }}
      >
        <div
          onPointerDown={(e) => startInteraction('move-shape', e)}
          className="absolute inset-0 border-2 border-black border-dashed pointer-events-auto rounded cursor-move bg-black/[0.04]"
        />

        {/* Rotation Handle (Above top-center of shape, with vertical stem) */}
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-40">
          <div
            onPointerDown={(e) => startInteraction('rotate-shape', e)}
            className="w-3.5 h-3.5 rounded-full bg-white border-2 border-black hover:scale-125 transition-transform cursor-grab active:cursor-grabbing shadow-md"
            title="Повернуть фигуру (Shift = шаг 15°)"
          />
          <div className="w-[1.5px] h-5 bg-black" />
        </div>

        {/* Dedicated Delete Button on Top Right */}
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

        {/* Rotation Indicator Pill */}
        {Math.round(rotation) !== 0 ? (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black text-[9px] font-mono text-white pointer-events-none shadow whitespace-nowrap">
            {Math.round(rotation)}°
          </div>
        ) : null}
      </div>
    );
  }

  return null;
};
