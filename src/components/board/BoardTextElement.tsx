import React, { useState, useRef, useEffect } from 'react';
import { BoardTextObject } from '../../types';
import { Trash2 } from 'lucide-react';

interface BoardTextElementProps {
  textObj: BoardTextObject;
  isSelected: boolean;
  isInGroup?: boolean;
  isEditingDirectly?: boolean;
  zoom: number;
  viewportX: number;
  viewportY: number;
  isEraserActive?: boolean;
  onSelect: (e: React.PointerEvent) => void;
  onUpdateText: (updated: BoardTextObject, isFinal?: boolean) => void;
  onDelete: () => void;
  onFinishEditing?: () => void;
  onCommitHistory?: () => void;
}

export const BoardTextElement: React.FC<BoardTextElementProps> = ({
  textObj,
  isSelected,
  isInGroup = false,
  isEditingDirectly = false,
  zoom,
  viewportX,
  viewportY,
  isEraserActive = false,
  onSelect,
  onUpdateText,
  onDelete,
  onFinishEditing,
  onCommitHistory,
}) => {
  const [isEditing, setIsEditing] = useState(isEditingDirectly && !isEraserActive && !isInGroup);
  const [currentText, setCurrentText] = useState(textObj.text);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const mountTimeRef = useRef(Date.now());
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    setCurrentText(textObj.text);
  }, [textObj.text]);

  useEffect(() => {
    if (isEditingDirectly && !isEraserActive && !isInGroup) {
      setIsEditing(true);
    }
  }, [isEditingDirectly, isEraserActive, isInGroup]);

  useEffect(() => {
    if (isEraserActive || isInGroup) {
      setIsEditing(false);
    }
  }, [isEraserActive, isInGroup]);

  // Adjust textarea height dynamically to content
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      const minH = 28;
      const targetH = Math.max(minH, scrollH);
      textareaRef.current.style.height = `${targetH}px`;
      return targetH;
    }
    return 28;
  };

  useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight();
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          adjustTextareaHeight();
          textareaRef.current.focus({ preventScroll: true });
          textareaRef.current.select();
        }
      });
    }
  }, [isEditing, textObj.fontSize, textObj.width]);

  const isResizingRef = useRef(false);

  // Synchronize textObj.height with measured DOM height in view mode if content exceeds allocated height
  useEffect(() => {
    if (isEditing || isResizingRef.current || !containerRef.current) return;
    const measuredH = containerRef.current.offsetHeight;
    // Only auto-expand height if text overflows the current height
    if (measuredH > 0 && measuredH > (textObj.height || 0)) {
      onUpdateText(
        {
          ...textObj,
          height: measuredH,
        },
        false
      );
    }
  }, [textObj.text, textObj.fontSize, textObj.width, isEditing]);

  const screenX = textObj.x * zoom + viewportX;
  const screenY = textObj.y * zoom + viewportY;

  const handleBlur = () => {
    // Prevent immediate deletion from spurious blur during mouseup settling right after creation
    if (Date.now() - mountTimeRef.current < 400 && !hasInteractedRef.current) {
      textareaRef.current?.focus({ preventScroll: true });
      return;
    }

    setIsEditing(false);
    onFinishEditing?.();
    if (!currentText.trim()) {
      onDelete();
    } else {
      const measuredH = textareaRef.current
        ? Math.max(textObj.height || 38, textareaRef.current.scrollHeight)
        : (containerRef.current?.offsetHeight || 38);
      onUpdateText(
        {
          ...textObj,
          text: currentText,
          height: measuredH,
        },
        true
      );
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    hasInteractedRef.current = true;
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text/plain');
    if (!pastedText) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const prevVal = currentText;
    const nextVal = prevVal.substring(0, start) + pastedText + prevVal.substring(end);

    setCurrentText(nextVal);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const h = Math.max(textObj.height || 38, textareaRef.current.scrollHeight);
        textareaRef.current.style.height = `${h}px`;

        const newPos = start + pastedText.length;
        try {
          textareaRef.current.setSelectionRange(newPos, newPos);
        } catch (_) {}

        // Immediate reset of any browser scroll attempt on parent containers
        if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
        const boardViewport = textareaRef.current.closest('.board-viewport') as HTMLElement | null;
        if (boardViewport && (boardViewport.scrollTop !== 0 || boardViewport.scrollLeft !== 0)) {
          boardViewport.scrollTop = 0;
          boardViewport.scrollLeft = 0;
        }
        const boardRoot = textareaRef.current.closest('.board-root') as HTMLElement | null;
        if (boardRoot && (boardRoot.scrollTop !== 0 || boardRoot.scrollLeft !== 0)) {
          boardRoot.scrollTop = 0;
          boardRoot.scrollLeft = 0;
        }
        const mainEl = document.querySelector('main');
        if (mainEl && (mainEl.scrollTop !== 0 || mainEl.scrollLeft !== 0)) {
          mainEl.scrollTop = 0;
          mainEl.scrollLeft = 0;
        }
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    hasInteractedRef.current = true;
    if (e.key === 'Escape') {
      setIsEditing(false);
      onFinishEditing?.();
      if (!currentText.trim()) {
        onDelete();
      }
    }
  };

  // Handle dragging bottom-right corner to resize text container width/height
  // Handle moves 1:1 with cursor, upper-left corner stays strictly in place
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    isResizingRef.current = true;

    const startTextX = textObj.x;
    const startTextY = textObj.y;

    // Get the exact current visual dimensions of the box in board coordinates
    const startBoxW = textObj.width || (containerRef.current ? containerRef.current.offsetWidth : 220);
    const startBoxH = Math.max(textObj.height || 0, containerRef.current ? containerRef.current.offsetHeight : 38);

    // Initial position of bottom-right handle in world units
    const startHandleWorldX = startTextX + startBoxW;
    const startHandleWorldY = startTextY + startBoxH;

    // Initial cursor position in world units
    const startCursorWorldX = (e.clientX - viewportX) / zoom;
    const startCursorWorldY = (e.clientY - viewportY) / zoom;

    // Initial grab offset between cursor and handle (preserves exact point on handle where grabbed)
    const grabOffsetWorldX = startHandleWorldX - startCursorWorldX;
    const grabOffsetWorldY = startHandleWorldY - startCursorWorldY;

    // Base minimum width
    const minW = 50;

    let hasResized = false;
    let lastW = startBoxW;
    let lastH = startBoxH;

    const onPointerMove = (ev: PointerEvent) => {
      // Calculate current cursor position in world coordinates
      const currentCursorWorldX = (ev.clientX - viewportX) / zoom;
      const currentCursorWorldY = (ev.clientY - viewportY) / zoom;

      // Target bottom-right world point matching the initial grab point 1:1
      const targetWorldRight = currentCursorWorldX + grabOffsetWorldX;
      const targetWorldBottom = currentCursorWorldY + grabOffsetWorldY;

      // New width and height calculated strictly relative to the initial grab point
      const targetW = Math.round(targetWorldRight - startTextX);
      const targetH = Math.round(targetWorldBottom - startTextY);

      // The natural height required to display the text content
      const contentHeight = contentRef.current ? contentRef.current.offsetHeight : 28;
      const minH = Math.max(28, contentHeight);

      // Constrain to allowed dimensions
      const newW = Math.max(minW, targetW);
      const newH = Math.max(minH, targetH);

      lastW = newW;
      lastH = newH;
      hasResized = true;

      onUpdateText(
        {
          ...textObj,
          width: newW,
          height: newH,
        },
        false
      );
    };

    const onPointerUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (hasResized) {
        onUpdateText(
          {
            ...textObj,
            width: lastW,
            height: lastH,
          },
          true
        );
        onCommitHistory?.();
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const isCurrentlyEditing = isEditing && !isEraserActive && !isInGroup;

  return (
    <div
      ref={containerRef}
      onPointerDown={
        isEraserActive
          ? undefined
          : (e) => {
              onSelect(e);
            }
      }
      onDoubleClick={
        isEraserActive || isInGroup
          ? undefined
          : (e) => {
              e.stopPropagation();
              setIsEditing(true);
            }
      }
      className={`absolute select-none overflow-visible max-w-none ${
        isEraserActive
          ? 'pointer-events-none z-0'
          : isInGroup
          ? 'cursor-move z-20'
          : isSelected && !isCurrentlyEditing
          ? 'ring-2 ring-black bg-black/[0.02] rounded-sm cursor-move shadow-[0_0_0_1px_rgba(255,255,255,0.7)] z-30'
          : !isCurrentlyEditing
          ? 'hover:ring-1 hover:ring-black/20 rounded cursor-pointer z-10'
          : 'z-40'
      }`}
      style={{
        left: screenX,
        top: screenY,
        width: textObj.width ? `${textObj.width}px` : '220px',
        minHeight: textObj.height ? `${textObj.height}px` : '38px',
        transform: `scale(${zoom}) rotate(${textObj.rotation || 0}deg)`,
        transformOrigin: 'top left',
      }}
    >
      {/* Top-Right Delete Button for Selected Text (only when single selected) */}
      {isSelected && !isInGroup && !isCurrentlyEditing && !isEraserActive && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete();
          }}
          className="absolute -top-6 -right-2 w-5 h-5 rounded-full bg-black text-white hover:bg-red-600 border border-white flex items-center justify-center pointer-events-auto shadow-md transition-colors z-50 cursor-pointer"
          title="Удалить текст (Delete / Backspace)"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

      {/* Bottom-Right Corner Resize Handle (only when single selected) */}
      {isSelected && !isInGroup && !isCurrentlyEditing && !isEraserActive && (
        <div
          onPointerDown={handleResizePointerDown}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-black rounded-full cursor-nwse-resize shadow-sm hover:scale-125 transition-transform z-50 pointer-events-auto"
          title="Изменить размер текста (потяните)"
        />
      )}

      {isCurrentlyEditing ? (
        <textarea
          ref={textareaRef}
          value={currentText}
          placeholder="Введите текст..."
          onPaste={handlePaste}
          onChange={(e) => {
            hasInteractedRef.current = true;
            setCurrentText(e.target.value);
            e.target.style.height = 'auto';
            const h = Math.max(textObj.height || 38, e.target.scrollHeight);
            e.target.style.height = `${h}px`;
            if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            fontSize: `${textObj.fontSize}px`,
            color: textObj.color,
            lineHeight: 1.35,
            width: '100%',
            minHeight: textObj.height ? `${textObj.height}px` : '38px',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}
          className="bg-white/95 border-2 border-black rounded p-2 outline-none resize-none font-sans shadow-2xl allow-select break-words whitespace-pre-wrap w-full box-border"
        />
      ) : (
        <div
          ref={contentRef}
          style={{
            fontSize: `${textObj.fontSize}px`,
            color: textObj.color,
            lineHeight: 1.35,
            width: '100%',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}
          className="p-1 font-sans break-words whitespace-pre-wrap select-none w-full box-border"
        >
          {textObj.text || 'Текст...'}
        </div>
      )}
    </div>
  );
};
