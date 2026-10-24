import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Subject,
  TaskItem,
  BoardTool,
  EraserMode,
  BoardStroke,
  BoardTextObject,
  BoardImageObject,
  BoardShapeObject,
  ShapeType,
  BoardState,
  BoardPoint,
  SelectedItem,
} from '../../types';
import {
  getBoardState,
  saveBoardState,
  saveFileAttachment,
} from '../../lib/db';
import { BoardToolbar } from './BoardToolbar';
import { BoardCanvas } from './BoardCanvas';
import { BoardImageElement } from './BoardImageElement';
import { BoardTextElement } from './BoardTextElement';
import { BoardShapeElement } from './BoardShapeElement';
import { BoardControls } from './BoardControls';
import { SHAPE_MAP, renderShapeSVG } from './shapeDefinitions';
import { ArrowLeft, CircleHelp } from 'lucide-react';

interface BoardViewProps {
  subject: Subject;
  task: TaskItem;
  onBack: () => void;
  onSelectAnotherTask: () => void;
}

const DEFAULT_COLOR = '#111111';
const DEFAULT_STROKE_WIDTH = 3;

export const BoardView: React.FC<BoardViewProps> = ({
  subject,
  task,
  onBack,
  onSelectAnotherTask,
}) => {
  // Active tool state
  const [activeTool, setActiveTool] = useState<BoardTool>('pen');
  const [penColor, setPenColor] = useState<string>(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState<number>(DEFAULT_STROKE_WIDTH);
  const [textColor, setTextColor] = useState<string>(DEFAULT_COLOR);
  const [textFontSize, setTextFontSize] = useState<number>(18);
  const [activeShapeType, setActiveShapeType] = useState<ShapeType>('rectangle');
  const [shapeColor, setShapeColor] = useState<string>(DEFAULT_COLOR);
  const [eraserMode, setEraserMode] = useState<EraserMode>('area');
  const [eraserRadius, setEraserRadius] = useState<number>(14);

  // Viewport camera (world to screen)
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number }>({
    x: 80,
    y: 80,
    zoom: 1,
  });

  // World objects
  const [strokes, setStrokes] = useState<BoardStroke[]>([]);
  const [texts, setTexts] = useState<BoardTextObject[]>([]);
  const [images, setImages] = useState<BoardImageObject[]>([]);
  const [shapes, setShapes] = useState<BoardShapeObject[]>([]);

  // Selection system
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // Text being directly edited
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Marquee selection state & ref for synchronous tracking
  const [marqueeRect, setMarqueeRect] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const marqueeBoxRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const isMarqueeRef = useRef(false);

  // Drawing state
  const [currentStroke, setCurrentStroke] = useState<BoardStroke[]>([]);
  const activeStrokeRef = useRef<BoardStroke | null>(null);

  // Smooth GPU Eraser cursor (screen coords)
  const [eraserCursorPos, setEraserCursorPos] = useState<{ x: number; y: number } | null>(null);
  const isErasingRef = useRef(false);
  const lastEraserPosRef = useRef<{ x: number; y: number } | null>(null);

  // Compact expandable bottom hints pill state
  const [isHintExpanded, setIsHintExpanded] = useState(false);

  // Shape placement ghost cursor preview & two-click custom line draft start point
  const [isShapeCursorVisible, setIsShapeCursorVisible] = useState(false);
  const isShapeCursorVisibleRef = useRef(false);
  const shapeCursorPosRef = useRef<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const [lineDraftStart, setLineDraftStart] = useState<{ x: number; y: number } | null>(null);

  // Direct DOM refs for zero-latency preview updates on pointermove
  const customLinePreviewLineRef = useRef<SVGLineElement | null>(null);
  const customLinePreviewStartRef = useRef<SVGCircleElement | null>(null);
  const customLinePreviewEndRef = useRef<SVGCircleElement | null>(null);
  const customLineCursorDotRef = useRef<HTMLDivElement | null>(null);
  const shapeGhostPreviewRef = useRef<HTMLDivElement | null>(null);

  const hideShapeCursorPreview = useCallback(() => {
    isShapeCursorVisibleRef.current = false;
    setIsShapeCursorVisible(false);
  }, []);

  // Clear custom line draft when tool or active shape type changes
  useEffect(() => {
    setLineDraftStart(null);
  }, [activeTool, activeShapeType]);

  // History stack
  const [history, setHistory] = useState<
    Array<{
      strokes: BoardStroke[];
      texts: BoardTextObject[];
      images: BoardImageObject[];
      shapes: BoardShapeObject[];
    }>
  >([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // State refs for clean gesture callbacks and synchronous unmount flushing without stale closures
  const strokesRef = useRef(strokes);
  const textsRef = useRef(texts);
  const imagesRef = useRef(images);
  const shapesRef = useRef(shapes);
  const viewportRef = useRef(viewport);
  const subjectIdRef = useRef(subject.id);
  const taskIdRef = useRef(task.id);

  strokesRef.current = strokes;
  textsRef.current = texts;
  imagesRef.current = images;
  shapesRef.current = shapes;
  viewportRef.current = viewport;
  subjectIdRef.current = subject.id;
  taskIdRef.current = task.id;

  // Auto-save & lifecycle coordination refs
  const loadedTaskIdRef = useRef<string | null>(null);
  const hydratingTaskIdRef = useRef<string | null>(null);
  const isDirtyRef = useRef<boolean>(false);
  const revisionRef = useRef<number>(0);
  const savedRevisionRef = useRef<number>(0);
  const lastUpdatedAtRef = useRef<number>(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DOM Containers
  const rootRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const breadcrumbRef = useRef<HTMLDivElement | null>(null);
  const [isBreadcrumbHidden, setIsBreadcrumbHidden] = useState<boolean>(false);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Absolute scroll immunity: the board coordinate system is strictly virtual (viewport.x, viewport.y).
  // Any DOM scrollTop/scrollLeft must be locked to 0 regardless of browser focus or paste events.
  useEffect(() => {
    const lockZeroScroll = () => {
      if (rootRef.current && (rootRef.current.scrollTop !== 0 || rootRef.current.scrollLeft !== 0)) {
        rootRef.current.scrollTop = 0;
        rootRef.current.scrollLeft = 0;
      }
      if (containerRef.current && (containerRef.current.scrollTop !== 0 || containerRef.current.scrollLeft !== 0)) {
        containerRef.current.scrollTop = 0;
        containerRef.current.scrollLeft = 0;
      }
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
      if (document.documentElement.scrollTop !== 0 || document.documentElement.scrollLeft !== 0) {
        document.documentElement.scrollTop = 0;
        document.documentElement.scrollLeft = 0;
      }
      if (document.body.scrollTop !== 0 || document.body.scrollLeft !== 0) {
        document.body.scrollTop = 0;
        document.body.scrollLeft = 0;
      }
      const mainEl = document.querySelector('main');
      if (mainEl && (mainEl.scrollTop !== 0 || mainEl.scrollLeft !== 0)) {
        mainEl.scrollTop = 0;
        mainEl.scrollLeft = 0;
      }
    };

    window.addEventListener('scroll', lockZeroScroll, { passive: false, capture: true });
    document.addEventListener('scroll', lockZeroScroll, { passive: false, capture: true });
    const rootEl = rootRef.current;
    const containerEl = containerRef.current;
    rootEl?.addEventListener('scroll', lockZeroScroll, { passive: false, capture: true });
    containerEl?.addEventListener('scroll', lockZeroScroll, { passive: false, capture: true });

    return () => {
      window.removeEventListener('scroll', lockZeroScroll, { capture: true });
      document.removeEventListener('scroll', lockZeroScroll, { capture: true });
      rootEl?.removeEventListener('scroll', lockZeroScroll, { capture: true });
      containerEl?.removeEventListener('scroll', lockZeroScroll, { capture: true });
    };
  }, []);

  // Hidden File Input for Image upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Pan tracking
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; vpX: number; vpY: number }>({
    x: 0,
    y: 0,
    vpX: 0,
    vpY: 0,
  });

  // Synchronize viewport size and adaptive top bar collision detection via ResizeObserver
  const evaluateTopBarSpace = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const overlayWidth = containerEl.clientWidth;
    const overlayHeight = containerEl.clientHeight;

    setContainerSize((prev) =>
      prev.width === overlayWidth && prev.height === overlayHeight
        ? prev
        : { width: overlayWidth, height: overlayHeight }
    );

    const breadcrumbEl = breadcrumbRef.current;
    const toolbarEl = toolbarRef.current;
    if (!breadcrumbEl || !toolbarEl) return;

    // offsetWidth returns untransformed layout width (invariant to CSS scale/translate/opacity)
    const breadcrumbWidth = breadcrumbEl.offsetWidth;
    const measuredToolbarWidth = toolbarEl.offsetWidth;

    // Account immediately for expected single-row width when switching to tools with inline sub-toolbars
    const isSingleRowMode = overlayWidth >= 700;
    let expectedSubToolbarWidth = 0;
    if (isSingleRowMode) {
      if (activeTool === 'pen') expectedSubToolbarWidth = 195;
      else if (activeTool === 'shape') expectedSubToolbarWidth = 180;
      else if (activeTool === 'text') expectedSubToolbarWidth = 165;
      else if (activeTool === 'eraser') expectedSubToolbarWidth = eraserMode === 'area' ? 250 : 140;
      if (selectedItems.length > 0) expectedSubToolbarWidth += 56;
    }
    const baseToolbarWidth = 446;
    const effectiveToolbarWidth = Math.max(
      measuredToolbarWidth,
      isSingleRowMode ? baseToolbarWidth + expectedSubToolbarWidth : measuredToolbarWidth
    );

    // Centered toolbar left edge vs breadcrumb right edge (left-4 = 16px) + 20px safe margin
    const availableLeftSpace = (overlayWidth - effectiveToolbarWidth) / 2;
    const requiredLeftSpace = 16 + breadcrumbWidth + 20;

    const shouldHide = breadcrumbWidth > 0 && availableLeftSpace < requiredLeftSpace;
    setIsBreadcrumbHidden((prev) => (prev === shouldHide ? prev : shouldHide));
  }, [activeTool, eraserMode, selectedItems.length]);

  useEffect(() => {
    evaluateTopBarSpace();
    window.addEventListener('resize', evaluateTopBarSpace);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        evaluateTopBarSpace();
      });
      if (containerRef.current) observer.observe(containerRef.current);
      if (toolbarRef.current) observer.observe(toolbarRef.current);
      if (breadcrumbRef.current) observer.observe(breadcrumbRef.current);
    }

    return () => {
      window.removeEventListener('resize', evaluateTopBarSpace);
      observer?.disconnect();
    };
  }, [evaluateTopBarSpace, subject.title, task.title, task.taskNumber]);

  // Build a consistent snapshot of the current board state with a strictly monotonic timestamp
  const buildBoardSnapshot = useCallback((targetTaskId: string, targetSubjectId: string): BoardState | null => {
    if (loadedTaskIdRef.current !== targetTaskId) {
      return null;
    }

    const activeStroke = activeStrokeRef.current;
    const finalStrokes =
      activeStroke && activeStroke.points.length > 0
        ? [...strokesRef.current, activeStroke]
        : strokesRef.current;

    const nextTimestamp = Math.max(Date.now(), lastUpdatedAtRef.current + 1);
    lastUpdatedAtRef.current = nextTimestamp;

    return {
      subjectId: targetSubjectId,
      taskId: targetTaskId,
      strokes: finalStrokes,
      texts: textsRef.current,
      images: imagesRef.current,
      shapes: shapesRef.current,
      viewport: viewportRef.current,
      updatedAt: nextTimestamp,
    };
  }, []);

  // Flush any pending unsaved changes for the loaded task immediately
  const flushBoardSave = useCallback(
    async (explicitTaskId?: string, explicitSubjectId?: string): Promise<void> => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      const targetTaskId = explicitTaskId ?? taskIdRef.current;
      const targetSubjectId = explicitSubjectId ?? subjectIdRef.current;

      // Never save if the board state for this task has not finished loading from IndexedDB
      if (loadedTaskIdRef.current !== targetTaskId) {
        return;
      }

      const hasActiveStroke = Boolean(
        activeStrokeRef.current && activeStrokeRef.current.points.length > 0
      );
      if (!isDirtyRef.current && savedRevisionRef.current >= revisionRef.current && !hasActiveStroke) {
        return;
      }

      const snapshotRevision = revisionRef.current;
      const snapshot = buildBoardSnapshot(targetTaskId, targetSubjectId);
      if (!snapshot) return;

      savedRevisionRef.current = snapshotRevision;
      isDirtyRef.current = false;

      try {
        await saveBoardState(snapshot);
      } catch (err) {
        // Restore dirty flag if no newer save has already succeeded
        if (savedRevisionRef.current === snapshotRevision) {
          isDirtyRef.current = true;
        }
        console.error('Failed to save board state:', err);
      }
    },
    [buildBoardSnapshot]
  );

  // Load saved state for this specific task
  useEffect(() => {
    let active = true;
    const currentTaskId = task.id;
    const currentSubjectId = subject.id;

    // Reset load status for the new task until getBoardState resolves
    loadedTaskIdRef.current = null;
    hydratingTaskIdRef.current = null;
    isDirtyRef.current = false;

    async function loadData() {
      try {
        const saved = await getBoardState(currentTaskId);
        if (!active) return;

        if (saved) {
          const loadedStrokes = saved.strokes || [];
          const loadedTexts = saved.texts || [];
          const loadedImages = saved.images || [];
          const loadedShapes = saved.shapes || [];
          const loadedViewport = saved.viewport || { x: 80, y: 80, zoom: 1 };

          strokesRef.current = loadedStrokes;
          textsRef.current = loadedTexts;
          imagesRef.current = loadedImages;
          shapesRef.current = loadedShapes;
          viewportRef.current = loadedViewport;

          lastUpdatedAtRef.current = Math.max(lastUpdatedAtRef.current, saved.updatedAt || 0);
          revisionRef.current = 0;
          savedRevisionRef.current = 0;
          isDirtyRef.current = false;
          hydratingTaskIdRef.current = currentTaskId;
          loadedTaskIdRef.current = currentTaskId;

          setStrokes(loadedStrokes);
          setTexts(loadedTexts);
          setImages(loadedImages);
          setShapes(loadedShapes);
          setViewport(loadedViewport);
          setHistory([
            {
              strokes: loadedStrokes,
              texts: loadedTexts,
              images: loadedImages,
              shapes: loadedShapes,
            },
          ]);
          setHistoryIndex(0);
        } else {
          const initialImages: BoardImageObject[] = [];
          if (task.exampleAttachment?.fileId) {
            initialImages.push({
              id: `img-${Date.now()}`,
              fileId: task.exampleAttachment.fileId,
              x: 100,
              y: 100,
              width: 520,
              height: 380,
              rotation: 0,
            });
          }

          const initialViewport = { x: 80, y: 80, zoom: 1 };

          strokesRef.current = [];
          textsRef.current = [];
          imagesRef.current = initialImages;
          shapesRef.current = [];
          viewportRef.current = initialViewport;

          const hasInitialSeededContent = initialImages.length > 0;
          revisionRef.current = hasInitialSeededContent ? 1 : 0;
          savedRevisionRef.current = 0;
          isDirtyRef.current = hasInitialSeededContent;
          hydratingTaskIdRef.current = currentTaskId;
          loadedTaskIdRef.current = currentTaskId;

          setStrokes([]);
          setTexts([]);
          setImages(initialImages);
          setShapes([]);
          setViewport(initialViewport);
          setHistory([
            {
              strokes: [],
              texts: [],
              images: initialImages,
              shapes: [],
            },
          ]);
          setHistoryIndex(0);
        }
      } catch (err) {
        console.error('Failed to load board state:', err);
      }
    }

    loadData();

    return () => {
      active = false;
      void flushBoardSave(currentTaskId, currentSubjectId);
    };
  }, [task.id, subject.id, task.exampleAttachment?.fileId, flushBoardSave]);

  // Flush pending board changes if the window is closed or hidden
  useEffect(() => {
    const handleUnload = () => {
      void flushBoardSave();
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [flushBoardSave]);

  // Push unified history entry
  const pushHistory = useCallback(
    (
      newStrokes: BoardStroke[],
      newTexts: BoardTextObject[],
      newImages: BoardImageObject[],
      newShapes?: BoardShapeObject[]
    ) => {
      const resolvedShapes = newShapes !== undefined ? newShapes : shapesRef.current;
      strokesRef.current = newStrokes;
      textsRef.current = newTexts;
      imagesRef.current = newImages;
      shapesRef.current = resolvedShapes;

      if (loadedTaskIdRef.current === taskIdRef.current) {
        revisionRef.current += 1;
        isDirtyRef.current = true;
      }

      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        next.push({
          strokes: newStrokes,
          texts: newTexts,
          images: newImages,
          shapes: resolvedShapes,
        });
        if (next.length > 50) next.shift();
        return next;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 49));
    },
    [historyIndex]
  );

  const commitHistory = useCallback(() => {
    pushHistory(strokesRef.current, textsRef.current, imagesRef.current, shapesRef.current);
  }, [pushHistory]);

  // Background auto-save debounce (only after initial load completes for current task)
  useEffect(() => {
    if (loadedTaskIdRef.current !== task.id) {
      return;
    }

    // Ignore the state update triggered directly by initial DB hydration unless seeded with initial image
    if (hydratingTaskIdRef.current === task.id) {
      hydratingTaskIdRef.current = null;
      if (!isDirtyRef.current) {
        return;
      }
    } else {
      revisionRef.current += 1;
      isDirtyRef.current = true;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const currentTaskId = task.id;
    const currentSubjectId = subject.id;

    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      void flushBoardSave(currentTaskId, currentSubjectId);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [strokes, texts, images, shapes, viewport, subject.id, task.id, flushBoardSave]);

  // Undo / Redo actions
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetState = history[historyIndex - 1];
      const nextShapes = targetState.shapes || [];
      strokesRef.current = targetState.strokes;
      textsRef.current = targetState.texts;
      imagesRef.current = targetState.images;
      shapesRef.current = nextShapes;
      if (loadedTaskIdRef.current === taskIdRef.current) {
        revisionRef.current += 1;
        isDirtyRef.current = true;
      }
      setHistoryIndex((prev) => prev - 1);
      setStrokes(targetState.strokes);
      setTexts(targetState.texts);
      setImages(targetState.images);
      setShapes(nextShapes);
      setSelectedItems([]);
      setEditingTextId(null);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const targetState = history[historyIndex + 1];
      const nextShapes = targetState.shapes || [];
      strokesRef.current = targetState.strokes;
      textsRef.current = targetState.texts;
      imagesRef.current = targetState.images;
      shapesRef.current = nextShapes;
      if (loadedTaskIdRef.current === taskIdRef.current) {
        revisionRef.current += 1;
        isDirtyRef.current = true;
      }
      setHistoryIndex((prev) => prev + 1);
      setStrokes(targetState.strokes);
      setTexts(targetState.texts);
      setImages(targetState.images);
      setShapes(nextShapes);
      setSelectedItems([]);
      setEditingTextId(null);
    }
  }, [history, historyIndex]);

  // Zoom controls
  const handleZoom = useCallback(
    (delta: number, focalPoint?: { clientX: number; clientY: number }) => {
      setViewport((prev) => {
        const nextZoom = Math.min(4.0, Math.max(0.15, prev.zoom * delta));
        if (focalPoint && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const cursorX = focalPoint.clientX - rect.left;
          const cursorY = focalPoint.clientY - rect.top;

          const worldX = (cursorX - prev.x) / prev.zoom;
          const worldY = (cursorY - prev.y) / prev.zoom;

          const newX = cursorX - worldX * nextZoom;
          const newY = cursorY - worldY * nextZoom;

          return { x: newX, y: newY, zoom: nextZoom };
        } else {
          const cx = containerSize.width / 2;
          const cy = containerSize.height / 2;
          const worldX = (cx - prev.x) / prev.zoom;
          const worldY = (cy - prev.y) / prev.zoom;

          return {
            x: cx - worldX * nextZoom,
            y: cy - worldY * nextZoom,
            zoom: nextZoom,
          };
        }
      });
    },
    [containerSize]
  );

  // Wheel zoom / pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY < 0 ? 1.12 : 0.89;
      handleZoom(delta, { clientX: e.clientX, clientY: e.clientY });
    } else {
      setViewport((prev) => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Keyboard Spacebar Pan tracking
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const isSpacePressedRef = useRef(false);

  // Keyboard Shortcuts (works on both RU and EN keyboard layouts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      // Spacebar temporary Hand tool
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isSpacePressedRef.current) {
          isSpacePressedRef.current = true;
          setIsSpacePressed(true);
        }
        return;
      }

      const code = e.code;
      const key = e.key.toLowerCase();

      // Undo / Redo (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, supports Russian 'я' / 'н')
      if ((e.ctrlKey || e.metaKey) && (code === 'KeyZ' || key === 'z' || key === 'я')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (code === 'KeyY' || key === 'y' || key === 'н')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Zoom + / - / 0
      if ((e.ctrlKey || e.metaKey) && (code === 'Equal' || key === '=' || key === '+')) {
        e.preventDefault();
        handleZoom(1.15);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (code === 'Minus' || key === '-')) {
        e.preventDefault();
        handleZoom(0.85);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (code === 'Digit0' || key === '0')) {
        e.preventDefault();
        setViewport({ x: 80, y: 80, zoom: 1 });
        return;
      }

      // Delete (Del / Backspace)
      if (code === 'Delete' || code === 'Backspace' || key === 'delete' || key === 'backspace') {
        if (selectedItems.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
          return;
        }
      }

      // Escape cancels two-point custom line draft or deselects
      if (code === 'Escape' || key === 'escape') {
        if (lineDraftStart) {
          e.preventDefault();
          setLineDraftStart(null);
          return;
        }
      }

      // Quick tools shortcuts (works on English and Russian layouts)
      if (code === 'KeyV' || key === 'v' || key === 'м') {
        setActiveTool('select');
        setEditingTextId(null);
      } else if (code === 'KeyH' || key === 'h' || key === 'р') {
        setActiveTool('pan');
        setSelectedItems([]);
        setEditingTextId(null);
      } else if (code === 'KeyP' || key === 'p' || key === 'з') {
        setActiveTool('pen');
        setSelectedItems([]);
        setEditingTextId(null);
      } else if (code === 'KeyE' || key === 'e' || key === 'у') {
        setActiveTool('eraser');
        setSelectedItems([]);
        setEditingTextId(null);
      } else if (code === 'KeyT' || key === 't' || key === 'е') {
        setActiveTool('text');
        setSelectedItems([]);
        setEditingTextId(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleUndo, handleRedo, handleZoom, selectedItems, lineDraftStart]);

  // Geometric hit-testing helpers
  function boxIntersectsBox(
    ax1: number,
    ay1: number,
    ax2: number,
    ay2: number,
    bx1: number,
    by1: number,
    bx2: number,
    by2: number
  ) {
    return !(ax2 < bx1 || ax1 > bx2 || ay2 < by1 || ay1 > by2);
  }

  function distToSegment(p: BoardPoint, v: BoardPoint, w: BoardPoint) {
    const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  function segmentIntersectsBox(
    p1: BoardPoint,
    p2: BoardPoint,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): boolean {
    if (
      (p1.x >= x1 && p1.x <= x2 && p1.y >= y1 && p1.y <= y2) ||
      (p2.x >= x1 && p2.x <= x2 && p2.y >= y1 && p2.y <= y2)
    ) {
      return true;
    }
    const segMinX = Math.min(p1.x, p2.x);
    const segMaxX = Math.max(p1.x, p2.x);
    const segMinY = Math.min(p1.y, p2.y);
    const segMaxY = Math.max(p1.y, p2.y);
    if (segMaxX < x1 || segMinX > x2 || segMaxY < y1 || segMinY > y2) {
      return false;
    }
    const ccw = (A: BoardPoint, B: BoardPoint, C: BoardPoint) =>
      (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    const intersect = (A1: BoardPoint, A2: BoardPoint, B1: BoardPoint, B2: BoardPoint) =>
      ccw(A1, B1, B2) !== ccw(A2, B1, B2) && ccw(A1, A2, B1) !== ccw(A1, A2, B2);

    const corners: [BoardPoint, BoardPoint][] = [
      [{ x: x1, y: y1 }, { x: x2, y: y1 }],
      [{ x: x2, y: y1 }, { x: x2, y: y2 }],
      [{ x: x2, y: y2 }, { x: x1, y: y2 }],
      [{ x: x1, y: y2 }, { x: x1, y: y1 }],
    ];
    return corners.some(([b1, b2]) => intersect(p1, p2, b1, b2));
  }

  function distPointToBox(px: number, py: number, minX: number, minY: number, maxX: number, maxY: number): number {
    const dx = Math.max(minX - px, 0, px - maxX);
    const dy = Math.max(minY - py, 0, py - maxY);
    return Math.hypot(dx, dy);
  }

  function segmentIntersectsBoxWithRadius(
    p1: BoardPoint,
    p2: BoardPoint,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radius: number
  ): boolean {
    if (distPointToBox(p1.x, p1.y, x1, y1, x2, y2) <= radius) return true;
    if (distPointToBox(p2.x, p2.y, x1, y1, x2, y2) <= radius) return true;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    if (distPointToBox(midX, midY, x1, y1, x2, y2) <= radius) return true;
    return segmentIntersectsBox(p1, p2, x1 - radius, y1 - radius, x2 + radius, y2 + radius);
  }

  const findStrokeAtPoint = (x: number, y: number, threshold = 8): BoardStroke | null => {
    const currentStrokes = strokesRef.current;
    for (let i = currentStrokes.length - 1; i >= 0; i--) {
      const s = currentStrokes[i];
      const hitRadius = s.width / 2 + threshold;
      if (s.points.length === 1) {
        if (Math.hypot(x - s.points[0].x, y - s.points[0].y) <= hitRadius) {
          return s;
        }
        continue;
      }
      for (let j = 0; j < s.points.length - 1; j++) {
        const p1 = s.points[j];
        const p2 = s.points[j + 1];
        const dist = distToSegment({ x, y }, p1, p2);
        if (dist <= hitRadius) {
          return s;
        }
      }
    }
    return null;
  };

  // Direct Drag Handler: moves clicked item (or all currently selected items) immediately on pointerdown
  const startDirectObjectDrag = (
    clickedItem: SelectedItem,
    e: React.PointerEvent
  ) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();

    setEditingTextId(null);

    let currentSelected = selectedItems;
    if (e.shiftKey) {
      if (selectedItems.some((i) => i.id === clickedItem.id)) {
        currentSelected = selectedItems.filter((i) => i.id !== clickedItem.id);
      } else {
        currentSelected = [...selectedItems, clickedItem];
      }
      // "Линии + фото = фото НЕ входит в группу"
      if (currentSelected.some((i) => i.type === 'stroke')) {
        currentSelected = currentSelected.filter((i) => i.type !== 'image');
      }
      setSelectedItems(currentSelected);
      if (currentSelected.length === 0) return;
    } else {
      if (!selectedItems.some((i) => i.id === clickedItem.id)) {
        currentSelected = [clickedItem];
        setSelectedItems(currentSelected);
      }
    }

    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const initialImages = currentSelected
      .filter((i) => i.type === 'image')
      .map((i) => {
        const img = imagesRef.current.find((im) => im.id === i.id);
        return { id: i.id, x: img?.x || 0, y: img?.y || 0 };
      });
    const initialTexts = currentSelected
      .filter((i) => i.type === 'text')
      .map((i) => {
        const txt = textsRef.current.find((t) => t.id === i.id);
        return { id: i.id, x: txt?.x || 0, y: txt?.y || 0 };
      });
    const initialShapes = currentSelected
      .filter((i) => i.type === 'shape')
      .map((i) => {
        const shp = shapesRef.current.find((s) => s.id === i.id);
        return { id: i.id, x: shp?.x || 0, y: shp?.y || 0 };
      });
    const initialStrokes = currentSelected
      .filter((i) => i.type === 'stroke')
      .map((i) => {
        const s = strokesRef.current.find((st) => st.id === i.id);
        return { id: i.id, points: s ? s.points.map((p) => ({ ...p })) : [] };
      });

    let hasMoved = false;

    const onPointerMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClientX) / viewport.zoom;
      const dy = (ev.clientY - startClientY) / viewport.zoom;

      if (Math.hypot(dx, dy) > 1.5) {
        hasMoved = true;
      }

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

      handleUpdateMultipleAbsolute(updatedImages, updatedTexts, updatedStrokes, updatedShapes, false);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (hasMoved) {
        commitHistory();
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Dynamic color changer for Pen (only updates strokes, never text or shapes)
  const handleChangeColor = (newColor: string) => {
    setPenColor(newColor);
    if (selectedItems.length > 0) {
      let changed = false;
      const selectedIds = new Set(selectedItems.map((i) => i.id));

      const nextStrokes = strokesRef.current.map((s) => {
        if (selectedIds.has(s.id)) {
          changed = true;
          return { ...s, color: newColor };
        }
        return s;
      });

      if (changed) {
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
        pushHistory(nextStrokes, textsRef.current, imagesRef.current, shapesRef.current);
      }
    }
  };

  // Dedicated Text color changer (only updates selected text objects, never strokes or shapes)
  const handleChangeTextColor = (newColor: string) => {
    setTextColor(newColor);
    if (selectedItems.length > 0) {
      let changed = false;
      const selectedIds = new Set(selectedItems.map((i) => i.id));

      const nextTexts = textsRef.current.map((t) => {
        if (selectedIds.has(t.id)) {
          changed = true;
          return { ...t, color: newColor };
        }
        return t;
      });

      if (changed) {
        textsRef.current = nextTexts;
        setTexts(nextTexts);
        pushHistory(strokesRef.current, nextTexts, imagesRef.current, shapesRef.current);
      }
    }
  };

  // Dedicated Shape color changer (only updates selected shape objects, never strokes or texts)
  const handleChangeShapeColor = (newColor: string) => {
    setShapeColor(newColor);
    if (selectedItems.length > 0) {
      let changed = false;
      const selectedIds = new Set(selectedItems.map((i) => i.id));

      const nextShapes = shapesRef.current.map((s) => {
        if (selectedIds.has(s.id)) {
          changed = true;
          return { ...s, color: newColor };
        }
        return s;
      });

      if (changed) {
        shapesRef.current = nextShapes;
        setShapes(nextShapes);
        pushHistory(strokesRef.current, textsRef.current, imagesRef.current, nextShapes);
      }
    }
  };

  // Update single shape
  const handleUpdateShape = (updated: BoardShapeObject, isFinal = true) => {
    const nextShapes = shapesRef.current.map((s) => (s.id === updated.id ? updated : s));
    setShapes(nextShapes);
    shapesRef.current = nextShapes;
    if (loadedTaskIdRef.current === taskIdRef.current) {
      revisionRef.current += 1;
      isDirtyRef.current = true;
    }
    if (isFinal) {
      pushHistory(strokesRef.current, textsRef.current, imagesRef.current, nextShapes);
    }
  };

  // Dedicated Text font size changer (updates selected text objects or default for new text)
  const handleChangeTextFontSize = (newSize: number) => {
    setTextFontSize(newSize);
    if (selectedItems.length > 0) {
      let changed = false;
      const selectedIds = new Set(selectedItems.map((i) => i.id));

      const nextTexts = textsRef.current.map((t) => {
        if (selectedIds.has(t.id)) {
          changed = true;
          return { ...t, fontSize: newSize };
        }
        return t;
      });

      if (changed) {
        textsRef.current = nextTexts;
        setTexts(nextTexts);
        pushHistory(strokesRef.current, nextTexts, imagesRef.current, shapesRef.current);
      }
    }
  };

  // Dynamic stroke width changer (updates active strokeWidth AND any selected strokes)
  const handleChangeStrokeWidth = (newWidth: number) => {
    setStrokeWidth(newWidth);
    if (selectedItems.length > 0) {
      let changed = false;
      const selectedIds = new Set(selectedItems.map((i) => i.id));

      const nextStrokes = strokesRef.current.map((s) => {
        if (selectedIds.has(s.id)) {
          changed = true;
          return { ...s, width: newWidth };
        }
        return s;
      });

      if (changed) {
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
        pushHistory(nextStrokes, textsRef.current, imagesRef.current, shapesRef.current);
      }
    }
  };

  // Pointer Down on Board
  const handlePointerDown = (e: React.PointerEvent) => {
    // 1. Pan check (Spacebar held, Hand tool, or Middle mouse click)
    if (e.button === 1 || activeTool === 'pan' || e.buttons === 4 || isSpacePressedRef.current) {
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        vpX: viewport.x,
        vpY: viewport.y,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }

    if (e.button !== 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const boardX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const boardY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

    // 2. Pen tool
    if (activeTool === 'pen') {
      const newStroke: BoardStroke = {
        id: `strk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        points: [{ x: boardX, y: boardY }],
        color: penColor,
        width: strokeWidth,
      };
      activeStrokeRef.current = newStroke;
      setCurrentStroke([newStroke]);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }

    // 3. Eraser tool
    if (activeTool === 'eraser') {
      isErasingRef.current = true;
      lastEraserPosRef.current = { x: boardX, y: boardY };
      if (eraserMode === 'object') {
        eraseWholeObjectAtPoint(boardX, boardY);
      } else {
        eraseAreaAlongSegment(boardX, boardY, boardX, boardY);
      }
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }

    // 4. Text tool: creates text directly and opens active textarea
    if (activeTool === 'text') {
      const newText: BoardTextObject = {
        id: `txt-${Date.now()}`,
        x: boardX,
        y: boardY,
        text: '',
        fontSize: textFontSize,
        color: textColor,
        width: 220,
        height: 38,
      };
      const nextTexts = [...textsRef.current, newText];
      textsRef.current = nextTexts;
      setTexts(nextTexts);
      setSelectedItems([{ type: 'text', id: newText.id }]);
      setEditingTextId(newText.id);
      setActiveTool('select');
      return;
    }

    // 4b. Shape tool: places selected shape at click coordinates (or two-click line for 'line-custom')
    if (activeTool === 'shape') {
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      if (activeShapeType === 'line-custom') {
        if (!lineDraftStart) {
          shapeCursorPosRef.current = { x: boardX, y: boardY, screenX, screenY };
          isShapeCursorVisibleRef.current = true;
          setIsShapeCursorVisible(true);
          setLineDraftStart({ x: boardX, y: boardY });
          return;
        } else {
          const dx = boardX - lineDraftStart.x;
          const dy = boardY - lineDraftStart.y;
          const dist = Math.hypot(dx, dy);

          // Ignore accidental double-click on the exact same spot
          if (dist < 4) {
            return;
          }

          const angleDeg = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI) * 10) / 10;
          const lineThicknessBox = 28;
          const width = Math.max(20, Math.round(dist));
          const midX = (lineDraftStart.x + boardX) / 2;
          const midY = (lineDraftStart.y + boardY) / 2;

          const newShape: BoardShapeObject = {
            id: `shp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            type: 'line-custom',
            x: Math.round(midX - width / 2),
            y: Math.round(midY - lineThicknessBox / 2),
            width,
            height: lineThicknessBox,
            color: shapeColor,
            strokeWidth: 2.5,
            rotation: angleDeg,
          };

          const nextShapes = [...shapesRef.current, newShape];
          shapesRef.current = nextShapes;
          setShapes(nextShapes);
          setSelectedItems([{ type: 'shape', id: newShape.id }]);
          setLineDraftStart(null);
          shapeCursorPosRef.current = null;
          hideShapeCursorPreview();
          setActiveTool('select');
          pushHistory(strokesRef.current, textsRef.current, imagesRef.current, nextShapes);
          return;
        }
      }

      const shapeDef = SHAPE_MAP.get(activeShapeType);
      const defW = shapeDef ? shapeDef.defaultWidth : 120;
      const defH = shapeDef ? shapeDef.defaultHeight : 120;
      const newShape: BoardShapeObject = {
        id: `shp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: activeShapeType,
        x: Math.round(boardX - defW / 2),
        y: Math.round(boardY - defH / 2),
        width: defW,
        height: defH,
        color: shapeColor,
        strokeWidth: 2.5,
        rotation: 0,
      };
      const nextShapes = [...shapesRef.current, newShape];
      shapesRef.current = nextShapes;
      setShapes(nextShapes);
      setSelectedItems([{ type: 'shape', id: newShape.id }]);
      setActiveTool('select');
      shapeCursorPosRef.current = null;
      hideShapeCursorPreview();
      pushHistory(strokesRef.current, textsRef.current, imagesRef.current, nextShapes);
      return;
    }

    // 5. Select tool
    if (activeTool === 'select') {
      // Hit-test stroke first
      const clickedStroke = findStrokeAtPoint(boardX, boardY);
      if (clickedStroke) {
        startDirectObjectDrag({ type: 'stroke', id: clickedStroke.id }, e);
        return;
      }

      // Clicking empty board space: start rubberband / marquee selection
      setSelectedItems([]);
      setEditingTextId(null);
      isMarqueeRef.current = true;
      marqueeBoxRef.current = {
        startX: boardX,
        startY: boardY,
        currentX: boardX,
        currentY: boardY,
      };
      setMarqueeRect({ ...marqueeBoxRef.current });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  };

  // Pointer Move on Board
  const handlePointerMove = (e: React.PointerEvent) => {
    // 1. Panning
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewport((prev) => ({
        ...prev,
        x: panStartRef.current.vpX + dx,
        y: panStartRef.current.vpY + dy,
      }));
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const boardX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const boardY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

    // 2. Pen drawing
    if (activeTool === 'pen' && activeStrokeRef.current) {
      const stroke = activeStrokeRef.current;
      const pts = stroke.points;
      const lastPt = pts[pts.length - 1];

      const dist = Math.hypot(boardX - lastPt.x, boardY - lastPt.y);
      if (dist >= 1.5) {
        pts.push({ x: boardX, y: boardY });
        setCurrentStroke([{ ...stroke, points: [...pts] }]);
      }
      return;
    }

    // 3. Eraser
    if (activeTool === 'eraser') {
      setEraserCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (isErasingRef.current && e.buttons === 1) {
        if (eraserMode === 'area') {
          const prev = lastEraserPosRef.current || { x: boardX, y: boardY };
          eraseAreaAlongSegment(prev.x, prev.y, boardX, boardY);
          lastEraserPosRef.current = { x: boardX, y: boardY };
        } else {
          eraseWholeObjectAtPoint(boardX, boardY);
        }
      }
      return;
    }

    // 3b. Shape placement cursor (synchronous DOM update to avoid React re-render lag)
    if (activeTool === 'shape') {
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      shapeCursorPosRef.current = { x: boardX, y: boardY, screenX, screenY };

      if (!isShapeCursorVisibleRef.current) {
        isShapeCursorVisibleRef.current = true;
        setIsShapeCursorVisible(true);
      }

      if (activeShapeType === 'line-custom') {
        if (lineDraftStart) {
          const startScreenX = lineDraftStart.x * viewport.zoom + viewport.x;
          const startScreenY = lineDraftStart.y * viewport.zoom + viewport.y;
          customLinePreviewLineRef.current?.setAttribute('x1', String(startScreenX));
          customLinePreviewLineRef.current?.setAttribute('y1', String(startScreenY));
          customLinePreviewLineRef.current?.setAttribute('x2', String(screenX));
          customLinePreviewLineRef.current?.setAttribute('y2', String(screenY));
          customLinePreviewStartRef.current?.setAttribute('cx', String(startScreenX));
          customLinePreviewStartRef.current?.setAttribute('cy', String(startScreenY));
          customLinePreviewEndRef.current?.setAttribute('cx', String(screenX));
          customLinePreviewEndRef.current?.setAttribute('cy', String(screenY));
        } else if (customLineCursorDotRef.current) {
          customLineCursorDotRef.current.style.left = `${screenX}px`;
          customLineCursorDotRef.current.style.top = `${screenY}px`;
        }
      } else if (shapeGhostPreviewRef.current) {
        const defW = (SHAPE_MAP.get(activeShapeType)?.defaultWidth || 120) * viewport.zoom;
        const defH = (SHAPE_MAP.get(activeShapeType)?.defaultHeight || 120) * viewport.zoom;
        shapeGhostPreviewRef.current.style.left = `${screenX - defW / 2}px`;
        shapeGhostPreviewRef.current.style.top = `${screenY - defH / 2}px`;
      }
    }

    // 4. Marquee selection move
    if (activeTool === 'select' && isMarqueeRef.current && marqueeBoxRef.current) {
      marqueeBoxRef.current.currentX = boardX;
      marqueeBoxRef.current.currentY = boardY;
      setMarqueeRect({ ...marqueeBoxRef.current });
    }
  };

  // Pointer Up / Cancel on Board
  const handlePointerUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (isErasingRef.current) {
      isErasingRef.current = false;
      lastEraserPosRef.current = null;
      commitHistory();
    }

    if (activeTool === 'pen' && activeStrokeRef.current) {
      const finished = activeStrokeRef.current;
      activeStrokeRef.current = null;
      setCurrentStroke([]);

      if (finished.points.length > 0) {
        const nextStrokes = [...strokesRef.current, finished];
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
        pushHistory(nextStrokes, textsRef.current, imagesRef.current);
      }
    }

    // Finish marquee selection
    if (isMarqueeRef.current && marqueeBoxRef.current) {
      isMarqueeRef.current = false;
      const box = marqueeBoxRef.current;
      marqueeBoxRef.current = null;
      setMarqueeRect(null);

      const x1 = Math.min(box.startX, box.currentX);
      const y1 = Math.min(box.startY, box.currentY);
      const x2 = Math.max(box.startX, box.currentX);
      const y2 = Math.max(box.startY, box.currentY);

      if (x2 - x1 > 3 || y2 - y1 > 3) {
        const matched: SelectedItem[] = [];

        // 1. Check Images
        images.forEach((img) => {
          if (boxIntersectsBox(x1, y1, x2, y2, img.x, img.y, img.x + img.width, img.y + img.height)) {
            matched.push({ type: 'image', id: img.id });
          }
        });

        // 2. Check Texts
        texts.forEach((txt) => {
          const w = txt.width || Math.max(80, txt.text.length * (txt.fontSize * 0.6) + 20);
          const h = txt.height || Math.max(28, txt.fontSize * 1.5);
          if (boxIntersectsBox(x1, y1, x2, y2, txt.x, txt.y, txt.x + w, txt.y + h)) {
            matched.push({ type: 'text', id: txt.id });
          }
        });

        // 3. Check Strokes
        strokes.forEach((strk) => {
          let hit = false;
          for (let i = 0; i < strk.points.length; i++) {
            const p = strk.points[i];
            if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) {
              hit = true;
              break;
            }
            if (i < strk.points.length - 1) {
              if (segmentIntersectsBox(p, strk.points[i + 1], x1, y1, x2, y2)) {
                hit = true;
                break;
              }
            }
          }
          if (hit) {
            matched.push({ type: 'stroke', id: strk.id });
          }
        });

        // 4. Check Shapes (rotation-aware bounding box)
        shapes.forEach((shp) => {
          const cx = shp.x + shp.width / 2;
          const cy = shp.y + shp.height / 2;
          const rad = ((shp.rotation || 0) * Math.PI) / 180;
          const cos = Math.abs(Math.cos(rad));
          const sin = Math.abs(Math.sin(rad));
          const halfW = (shp.width * cos + shp.height * sin) / 2;
          const halfH = (shp.width * sin + shp.height * cos) / 2;
          if (boxIntersectsBox(x1, y1, x2, y2, cx - halfW, cy - halfH, cx + halfW, cy + halfH)) {
            matched.push({ type: 'shape', id: shp.id });
          }
        });

        // "Линии + фото = фото НЕ входит в группу. При групповом выделении линий фотография должна полностью игнорироваться"
        const hasStrokes = matched.some((i) => i.type === 'stroke');
        const finalMatched = hasStrokes ? matched.filter((i) => i.type !== 'image') : matched;
        setSelectedItems(finalMatched);
      }
    }
  };

  const handlePointerLeave = () => {
    setEraserCursorPos(null);
    if (!lineDraftStart) {
      hideShapeCursorPreview();
    }
  };

  // Eraser Mode 1: Erase whole object/stroke on click/touch
  const eraseWholeObjectAtPoint = (x: number, y: number) => {
    // 1. Check texts
    const currentTexts = textsRef.current;
    for (let i = currentTexts.length - 1; i >= 0; i--) {
      const txt = currentTexts[i];
      const lines = txt.text.split('\n');
      const maxLineLen = lines.reduce((max, l) => Math.max(max, l.length), 0);
      const estW = Math.max(60, maxLineLen * (txt.fontSize * 0.65) + 24);
      const estH = Math.max(28, lines.length * (txt.fontSize * 1.3) + 16);
      const pad = 10;
      if (x >= txt.x - pad && x <= txt.x + estW + pad && y >= txt.y - pad && y <= txt.y + estH + pad) {
        const nextTexts = currentTexts.filter((t) => t.id !== txt.id);
        textsRef.current = nextTexts;
        setTexts(nextTexts);
        setSelectedItems((prev) => prev.filter((item) => item.id !== txt.id));
        return;
      }
    }
    // 2. Check shapes (transform click point into shape's local unrotated coordinates)
    const currentShapes = shapesRef.current;
    for (let i = currentShapes.length - 1; i >= 0; i--) {
      const shp = currentShapes[i];
      const pad = 10;
      const cx = shp.x + shp.width / 2;
      const cy = shp.y + shp.height / 2;
      const rad = -((shp.rotation || 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const localX = cx + (x - cx) * cos - (y - cy) * sin;
      const localY = cy + (x - cx) * sin + (y - cy) * cos;
      if (
        localX >= shp.x - pad &&
        localX <= shp.x + shp.width + pad &&
        localY >= shp.y - pad &&
        localY <= shp.y + shp.height + pad
      ) {
        const nextShapes = currentShapes.filter((s) => s.id !== shp.id);
        shapesRef.current = nextShapes;
        setShapes(nextShapes);
        setSelectedItems((prev) => prev.filter((item) => item.id !== shp.id));
        pushHistory(strokesRef.current, textsRef.current, imagesRef.current, nextShapes);
        return;
      }
    }
    // 3. Check images
    const currentImages = imagesRef.current;
    for (let i = currentImages.length - 1; i >= 0; i--) {
      const img = currentImages[i];
      const pad = 10;
      if (x >= img.x - pad && x <= img.x + img.width + pad && y >= img.y - pad && y <= img.y + img.height + pad) {
        const nextImages = currentImages.filter((im) => im.id !== img.id);
        imagesRef.current = nextImages;
        setImages(nextImages);
        setSelectedItems((prev) => prev.filter((item) => item.id !== img.id));
        return;
      }
    }
    // 4. Check strokes
    const hitStroke = findStrokeAtPoint(x, y, 12);
    if (hitStroke) {
      const filtered = strokesRef.current.filter((s) => s.id !== hitStroke.id);
      strokesRef.current = filtered;
      setStrokes(filtered);
      setSelectedItems((prev) => prev.filter((item) => item.id !== hitStroke.id));
    }
  };

  // Helper: Subpixel bisection to find the exact cut point on segment [p1, p2] where distToSegment(P, e1, e2) == rEff
  function findCutPoint(
    p1: BoardPoint,
    p2: BoardPoint,
    e1: BoardPoint,
    e2: BoardPoint,
    rEff: number
  ): BoardPoint {
    let low = 0;
    let high = 1;
    const in1 = distToSegment(p1, e1, e2) < rEff;

    for (let iter = 0; iter < 10; iter++) {
      const mid = (low + high) / 2;
      const pMid = {
        x: p1.x + mid * (p2.x - p1.x),
        y: p1.y + mid * (p2.y - p1.y),
      };
      const inMid = distToSegment(pMid, e1, e2) < rEff;
      if (inMid === in1) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const t = (low + high) / 2;
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
  }

  // Eraser Mode 2: Geometric Line Cutting Along Eraser Path [e1, e2]
  const eraseAreaAlongSegment = (x0: number, y0: number, x1: number, y1: number) => {
    const e1 = { x: x0, y: y0 };
    const e2 = { x: x1, y: y1 };
    const radius = eraserRadius;

    const currentStrokes = strokesRef.current;
    let anyChanged = false;
    const nextStrokes: BoardStroke[] = [];

    // Bounding box of the eraser swept capsule
    const eMinX = Math.min(x0, x1) - radius;
    const eMaxX = Math.max(x0, x1) + radius;
    const eMinY = Math.min(y0, y1) - radius;
    const eMaxY = Math.max(y0, y1) + radius;

    for (let sIdx = 0; sIdx < currentStrokes.length; sIdx++) {
      const stroke = currentStrokes[sIdx];
      const pts = stroke.points;
      if (!pts || pts.length === 0) continue;

      const strokeRadius = stroke.width / 2;
      const R_eff = radius + strokeRadius;

      // 1. Single dot stroke
      if (pts.length === 1) {
        const d = distToSegment(pts[0], e1, e2);
        if (d < R_eff) {
          anyChanged = true;
          continue; // erased
        }
        nextStrokes.push(stroke);
        continue;
      }

      // 2. Pre-check bounding box of stroke including full stroke width
      let sMinX = Infinity,
        sMinY = Infinity,
        sMaxX = -Infinity,
        sMaxY = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x < sMinX) sMinX = p.x;
        if (p.x > sMaxX) sMaxX = p.x;
        if (p.y < sMinY) sMinY = p.y;
        if (p.y > sMaxY) sMaxY = p.y;
      }
      sMinX -= strokeRadius;
      sMaxX += strokeRadius;
      sMinY -= strokeRadius;
      sMaxY += strokeRadius;

      // If bounding boxes do not overlap, stroke cannot be touched
      if (eMaxX < sMinX || eMinX > sMaxX || eMaxY < sMinY || eMinY > sMaxY) {
        nextStrokes.push(stroke);
        continue;
      }

      // 3. Subdivide any long segments to guarantee maximum segment length <= maxStep
      // This ensures that no segment can skip across the eraser circle without having an endpoint inside
      const maxStep = Math.min(4, Math.max(1, R_eff / 2));
      const densePts: BoardPoint[] = [];
      densePts.push(pts[0]);

      for (let i = 0; i < pts.length - 1; i++) {
        const pA = pts[i];
        const pB = pts[i + 1];
        const segDist = Math.hypot(pB.x - pA.x, pB.y - pA.y);
        if (segDist > maxStep) {
          const steps = Math.ceil(segDist / maxStep);
          for (let step = 1; step < steps; step++) {
            const frac = step / steps;
            densePts.push({
              x: pA.x + frac * (pB.x - pA.x),
              y: pA.y + frac * (pB.y - pA.y),
            });
          }
        }
        densePts.push(pB);
      }

      // 4. Trace the dense points and cut precisely along the boundary distToSegment(P, e1, e2) = R_eff
      const newSegments: BoardPoint[][] = [];
      let currentSeg: BoardPoint[] = [];

      for (let i = 0; i < densePts.length - 1; i++) {
        const p1 = densePts[i];
        const p2 = densePts[i + 1];

        const in1 = distToSegment(p1, e1, e2) < R_eff;
        const in2 = distToSegment(p2, e1, e2) < R_eff;

        if (!in1 && !in2) {
          // Both outside
          if (currentSeg.length === 0) currentSeg.push(p1);
          currentSeg.push(p2);
        } else if (!in1 && in2) {
          // Entering eraser: find exact cut point
          anyChanged = true;
          if (currentSeg.length === 0) currentSeg.push(p1);
          const cut = findCutPoint(p1, p2, e1, e2, R_eff);
          currentSeg.push(cut);
          newSegments.push(currentSeg);
          currentSeg = [];
        } else if (in1 && !in2) {
          // Exiting eraser: find exact cut point
          anyChanged = true;
          const cut = findCutPoint(p1, p2, e1, e2, R_eff);
          currentSeg = [cut, p2];
        } else {
          // Both inside: erased
          anyChanged = true;
        }
      }

      if (currentSeg.length > 0) {
        newSegments.push(currentSeg);
      }

      // 5. Add surviving sub-strokes (filter out zero-length specks)
      let partCount = 0;
      for (let k = 0; k < newSegments.length; k++) {
        const seg = newSegments[k];
        if (seg.length >= 2) {
          let segLen = 0;
          for (let m = 0; m < seg.length - 1; m++) {
            segLen += Math.hypot(seg[m + 1].x - seg[m].x, seg[m + 1].y - seg[m].y);
          }
          if (segLen >= 1) {
            partCount++;
            nextStrokes.push({
              ...stroke,
              id: `${stroke.id}-p${partCount}-${Date.now()}`,
              points: seg,
            });
          }
        } else if (seg.length === 1 && !anyChanged) {
          nextStrokes.push(stroke);
        }
      }
    }

    if (anyChanged) {
      strokesRef.current = nextStrokes;
      setStrokes(nextStrokes);
      const nextStrokeIds = new Set(nextStrokes.map((s) => s.id));
      setSelectedItems((prev) => prev.filter((item) => item.type !== 'stroke' || nextStrokeIds.has(item.id)));
    }
  };

  // Upload image handler
  const handleUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await saveFileAttachment(fileId, file, file.name, file.type, file.size);

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        const maxDim = 560;
        let width = img.naturalWidth || 400;
        let height = img.naturalHeight || 300;

        if (width > maxDim || height > maxDim) {
          const ratio = width / height;
          if (width > height) {
            width = maxDim;
            height = maxDim / ratio;
          } else {
            height = maxDim;
            width = maxDim * ratio;
          }
        }

        const currentVp = viewportRef.current;
        const cx = containerSize.width / 2;
        const cy = containerSize.height / 2;
        const worldX = (cx - currentVp.x) / currentVp.zoom - width / 2;
        const worldY = (cy - currentVp.y) / currentVp.zoom - height / 2;

        const newImage: BoardImageObject = {
          id: `img-${Date.now()}`,
          fileId: fileId,
          x: worldX,
          y: worldY,
          width: Math.round(width),
          height: Math.round(height),
          rotation: 0,
        };

        const nextImages = [...imagesRef.current, newImage];
        imagesRef.current = nextImages;
        setImages(nextImages);
        setSelectedItems([{ type: 'image', id: newImage.id }]);
        pushHistory(strokesRef.current, textsRef.current, nextImages, shapesRef.current);
        URL.revokeObjectURL(objectUrl);
      };

      img.src = objectUrl;
    } catch (err) {
      console.error('Failed to upload image to board:', err);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Delete selected items
  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) return;
    const selectedIds = new Set(selectedItems.map((i) => i.id));

    const nextImages = imagesRef.current.filter((img) => !selectedIds.has(img.id));
    const nextTexts = textsRef.current.filter((txt) => !selectedIds.has(txt.id));
    const nextStrokes = strokesRef.current.filter((strk) => !selectedIds.has(strk.id));
    const nextShapes = shapesRef.current.filter((shp) => !selectedIds.has(shp.id));

    imagesRef.current = nextImages;
    textsRef.current = nextTexts;
    strokesRef.current = nextStrokes;
    shapesRef.current = nextShapes;
    setImages(nextImages);
    setTexts(nextTexts);
    setStrokes(nextStrokes);
    setShapes(nextShapes);
    setSelectedItems([]);
    setEditingTextId(null);
    pushHistory(nextStrokes, nextTexts, nextImages, nextShapes);
  };

  // Update image transformation
  const handleUpdateImage = (updated: BoardImageObject, isFinal = false) => {
    const nextImages = imagesRef.current.map((img) => (img.id === updated.id ? updated : img));
    setImages(nextImages);
    imagesRef.current = nextImages;
    if (loadedTaskIdRef.current === taskIdRef.current) {
      revisionRef.current += 1;
      isDirtyRef.current = true;
    }
    if (isFinal) {
      pushHistory(strokesRef.current, textsRef.current, nextImages, shapesRef.current);
    }
  };

  // Update text position
  const handleUpdateTextPos = (id: string, x: number, y: number, isFinal = false) => {
    const nextTexts = textsRef.current.map((t) => (t.id === id ? { ...t, x, y } : t));
    setTexts(nextTexts);
    textsRef.current = nextTexts;
    if (loadedTaskIdRef.current === taskIdRef.current) {
      revisionRef.current += 1;
      isDirtyRef.current = true;
    }
    if (isFinal) {
      pushHistory(strokesRef.current, nextTexts, imagesRef.current, shapesRef.current);
    }
  };

  // Update stroke points directly (absolute, zero-drift, zero-jitter)
  const handleUpdateStrokePoints = (id: string, newPoints: BoardPoint[], isFinal = false) => {
    const nextStrokes = strokesRef.current.map((s) => (s.id === id ? { ...s, points: newPoints } : s));
    setStrokes(nextStrokes);
    strokesRef.current = nextStrokes;
    if (loadedTaskIdRef.current === taskIdRef.current) {
      revisionRef.current += 1;
      isDirtyRef.current = true;
    }
    if (isFinal) {
      pushHistory(nextStrokes, textsRef.current, imagesRef.current, shapesRef.current);
    }
  };

  // Update multiple objects positions simultaneously (absolute, zero-jitter)
  const handleUpdateMultipleAbsolute = (
    updatedImages: { id: string; x: number; y: number }[],
    updatedTexts: { id: string; x: number; y: number; width?: number; height?: number; fontSize?: number }[],
    updatedStrokes: { id: string; points: BoardPoint[] }[],
    updatedShapes: { id: string; x: number; y: number; width?: number; height?: number }[] = [],
    isFinal = false
  ) => {
    let nextImages = imagesRef.current;
    if (updatedImages.length > 0) {
      const imgMap = new Map(updatedImages.map((i) => [i.id, i]));
      nextImages = imagesRef.current.map((img) => {
        const u = imgMap.get(img.id);
        return u ? { ...img, x: u.x, y: u.y } : img;
      });
      setImages(nextImages);
      imagesRef.current = nextImages;
    }

    let nextTexts = textsRef.current;
    if (updatedTexts.length > 0) {
      const txtMap = new Map(updatedTexts.map((t) => [t.id, t]));
      nextTexts = textsRef.current.map((txt) => {
        const u = txtMap.get(txt.id);
        return u ? { ...txt, ...u } : txt;
      });
      setTexts(nextTexts);
      textsRef.current = nextTexts;
    }

    let nextStrokes = strokesRef.current;
    if (updatedStrokes.length > 0) {
      const strkMap = new Map(updatedStrokes.map((s) => [s.id, s]));
      nextStrokes = strokesRef.current.map((s) => {
        const u = strkMap.get(s.id);
        return u ? { ...s, points: u.points } : s;
      });
      setStrokes(nextStrokes);
      strokesRef.current = nextStrokes;
    }

    let nextShapes = shapesRef.current;
    if (updatedShapes.length > 0) {
      const shpMap = new Map(updatedShapes.map((s) => [s.id, s]));
      nextShapes = shapesRef.current.map((shp) => {
        const u = shpMap.get(shp.id);
        return u ? { ...shp, ...u } : shp;
      });
      setShapes(nextShapes);
      shapesRef.current = nextShapes;
    }

    if (loadedTaskIdRef.current === taskIdRef.current) {
      revisionRef.current += 1;
      isDirtyRef.current = true;
    }

    if (isFinal) {
      pushHistory(nextStrokes, nextTexts, nextImages, nextShapes);
    }
  };

  // Update text content
  const handleUpdateText = (updated: BoardTextObject, isFinal = true) => {
    const nextTexts = textsRef.current.map((t) => (t.id === updated.id ? updated : t));
    setTexts(nextTexts);
    textsRef.current = nextTexts;
    if (loadedTaskIdRef.current === taskIdRef.current) {
      revisionRef.current += 1;
      isDirtyRef.current = true;
    }
    if (isFinal) {
      pushHistory(strokesRef.current, nextTexts, imagesRef.current, shapesRef.current);
    }
  };

  const handleBackWithFlush = async () => {
    await flushBoardSave();
    onBack();
  };

  const handleSelectAnotherTaskWithFlush = async () => {
    await flushBoardSave();
    onSelectAnotherTask();
  };

  // Grid background style calculation
  const gridSize = 24 * viewport.zoom;
  const gridOffsetX = viewport.x % gridSize;
  const gridOffsetY = viewport.y % gridSize;

  return (
    <div
      ref={rootRef}
      className="board-root relative w-full h-full overflow-hidden select-none touch-none"
      style={{ overflow: 'clip' }}
      onScroll={(e) => {
        if (e.currentTarget.scrollTop !== 0 || e.currentTarget.scrollLeft !== 0) {
          e.currentTarget.scrollTop = 0;
          e.currentTarget.scrollLeft = 0;
        }
      }}
    >
      {/* =========================================================================
          LAYER 1: FIXED UI VIEWPORT OVERLAY
          Positioned strictly relative to the Board viewport. Completely isolated
          from the infinite canvas, zoom/pan transforms, and text objects.
          ========================================================================= */}
      <div
        className="board-ui-overlay absolute inset-0 pointer-events-none z-40 overflow-hidden"
        style={{ overflow: 'clip' }}
      >
        {/* Floating Top Solid Toolbar */}
        <BoardToolbar
          activeTool={activeTool}
          onChangeTool={(tool) => {
            setActiveTool(tool);
            if (tool !== 'select') {
              setSelectedItems([]);
              setEditingTextId(null);
            }
            setEraserCursorPos(null);
          }}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onAddImageClick={() => fileInputRef.current?.click()}
          selectedColor={penColor}
          onChangeColor={handleChangeColor}
          strokeWidth={strokeWidth}
          onChangeStrokeWidth={handleChangeStrokeWidth}
          textColor={textColor}
          onChangeTextColor={handleChangeTextColor}
          textFontSize={textFontSize}
          onChangeTextFontSize={handleChangeTextFontSize}
          selectedShapeType={activeShapeType}
          onSelectShapeType={setActiveShapeType}
          shapeColor={shapeColor}
          onChangeShapeColor={handleChangeShapeColor}
          eraserMode={eraserMode}
          onChangeEraserMode={setEraserMode}
          eraserRadius={eraserRadius}
          onChangeEraserRadius={setEraserRadius}
          selectedCount={selectedItems.length}
          onDeleteSelected={handleDeleteSelected}
          zoomPercent={Math.round(viewport.zoom * 100)}
          onZoomIn={() => handleZoom(1.2)}
          onZoomOut={() => handleZoom(0.83)}
          onResetZoom={() => setViewport({ x: 80, y: 80, zoom: 1 })}
          onPointerEnterToolbar={() => setEraserCursorPos(null)}
          toolbarRef={toolbarRef}
          containerWidth={containerSize.width}
        />

        {/* Top Left Navigation Breadcrumb (Smoothly hides before colliding with centered toolbar) */}
        <div
          ref={breadcrumbRef}
          aria-hidden={isBreadcrumbHidden}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-4 left-4 z-40 flex items-center gap-2 cursor-default transition-[opacity,transform] duration-200 ease-out will-change-[opacity,transform] ${
            isBreadcrumbHidden
              ? 'opacity-0 -translate-x-2 scale-95 pointer-events-none select-none'
              : 'opacity-100 translate-x-0 scale-100 pointer-events-auto'
          }`}
        >
          <button
            tabIndex={isBreadcrumbHidden ? -1 : 0}
            onClick={handleBackWithFlush}
            title="Назад к списку заданий предмета"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0c0c0c]/90 text-neutral-300 hover:text-white border border-white/[0.12] text-xs font-medium backdrop-blur-md shadow-lg transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[160px]">{subject.title}</span>
          </button>

          <button
            tabIndex={isBreadcrumbHidden ? -1 : 0}
            onClick={handleSelectAnotherTaskWithFlush}
            title="Сменить задание"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0c0c0c]/90 text-neutral-300 hover:text-white border border-white/[0.12] text-xs font-medium backdrop-blur-md shadow-lg transition-colors cursor-pointer shrink-0"
          >
            <span className="font-mono text-white shrink-0">№ {task.taskNumber}</span>
            <span className="text-neutral-500 shrink-0">•</span>
            <span className="truncate max-w-[110px] text-neutral-400">
              {task.title || `Задание ${task.taskNumber}`}
            </span>
          </button>
        </div>

        {/* Bottom Hint Indicator (Compact Question Icon -> Smoothly Expands on Hover / Focus) */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Подсказки управления доской"
          aria-expanded={isHintExpanded}
          onMouseEnter={() => {
            setIsHintExpanded(true);
            setEraserCursorPos(null);
            if (!lineDraftStart) {
              hideShapeCursorPreview();
            }
          }}
          onMouseLeave={() => setIsHintExpanded(false)}
          onFocus={() => setIsHintExpanded(true)}
          onBlur={() => setIsHintExpanded(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              setIsHintExpanded((prev) => !prev);
            } else if (e.key === 'Escape' && isHintExpanded) {
              e.preventDefault();
              e.stopPropagation();
              setIsHintExpanded(false);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (e.detail === 0) {
              setIsHintExpanded((prev) => !prev);
            }
          }}
          className={`group absolute bottom-4 left-4 z-20 pointer-events-auto hidden sm:inline-flex items-center h-8 rounded-xl bg-[#0c0c0c]/85 hover:bg-[#0c0c0c]/95 border border-white/[0.08] hover:border-white/[0.15] shadow-md backdrop-blur-sm cursor-default select-none outline-none focus-visible:border-white/30 transition-[background-color,border-color,box-shadow] duration-250 ease-out`}
        >
          <span className="w-8 h-8 flex items-center justify-center shrink-0 text-neutral-400 group-hover:text-neutral-200 transition-colors duration-200">
            <CircleHelp className="w-4 h-4" />
          </span>
          <div
            className={`grid transition-[grid-template-columns,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isHintExpanded ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="flex items-center gap-2 pr-3 pl-0.5 whitespace-nowrap text-[11px] font-mono text-neutral-400">
                <span>Пробел/Колесо: Перемещение</span>
                <span>•</span>
                <span>Ctrl + Колесо: Zoom</span>
                <span>•</span>
                <span>Ctrl + Z: Отмена</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          LAYER 2: INTERACTIVE BOARD CANVAS & OBJECTS
          Infinite virtual space with pan/zoom transforms and drawing canvas.
          ========================================================================= */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onScroll={(e) => {
          if (e.currentTarget.scrollTop !== 0 || e.currentTarget.scrollLeft !== 0) {
            e.currentTarget.scrollTop = 0;
            e.currentTarget.scrollLeft = 0;
          }
        }}
        className={`board-viewport absolute inset-0 w-full h-full overflow-hidden select-none touch-none ${
          isSpacePressed || activeTool === 'pan'
            ? 'cursor-grab active:cursor-grabbing'
            : activeTool === 'pen'
            ? 'cursor-crosshair'
            : activeTool === 'eraser'
            ? (eraserMode === 'area' ? 'cursor-none' : 'cursor-crosshair')
            : activeTool === 'text'
            ? 'cursor-text'
            : activeTool === 'shape'
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
        style={{
          overflow: 'clip',
          backgroundColor: '#ffffff',
          backgroundImage: `
            linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
        }}
      >
        {/* Hidden File Input for Image uploading */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUploadImageFile}
          className="hidden"
        />

      {/* Layer 1: Images */}
      {images.map((img) => (
        <BoardImageElement
          key={img.id}
          image={img}
          isSelected={selectedItems.some((i) => i.id === img.id)}
          isEraserActive={activeTool === 'eraser' || activeTool === 'shape'}
          zoom={viewport.zoom}
          viewportX={viewport.x}
          viewportY={viewport.y}
          onSelect={(e) => {
            if (activeTool === 'select') {
              startDirectObjectDrag({ type: 'image', id: img.id }, e);
            }
          }}
        />
      ))}

      {/* Layer 2: Vector Drawing Canvas (Freehand Pen, Eraser) */}
      <BoardCanvas
        strokes={strokes}
        currentStroke={currentStroke[0] || null}
        viewportX={viewport.x}
        viewportY={viewport.y}
        zoom={viewport.zoom}
        width={containerSize.width}
        height={containerSize.height}
        eraserPreview={null}
        marqueeRect={null}
      />

      {/* Area Eraser Floating Cursor Ring */}
      {activeTool === 'eraser' && eraserMode === 'area' && eraserCursorPos && (
        <div
          className="absolute pointer-events-none z-50 rounded-full border border-black/80 bg-black/10 transition-none"
          style={{
            width: eraserRadius * 2 * viewport.zoom,
            height: eraserRadius * 2 * viewport.zoom,
            left: eraserCursorPos.x - eraserRadius * viewport.zoom,
            top: eraserCursorPos.y - eraserRadius * viewport.zoom,
          }}
        />
      )}

      {/* Shape Placement Ghost Preview & Two-Point Custom Line Preview */}
      {activeTool === 'shape' && (isShapeCursorVisible || lineDraftStart) && (
        activeShapeType === 'line-custom' ? (
          lineDraftStart ? (
            <svg
              className="absolute inset-0 pointer-events-none z-40"
              width={containerSize.width}
              height={containerSize.height}
            >
              <line
                ref={customLinePreviewLineRef}
                x1={lineDraftStart.x * viewport.zoom + viewport.x}
                y1={lineDraftStart.y * viewport.zoom + viewport.y}
                x2={
                  shapeCursorPosRef.current
                    ? shapeCursorPosRef.current.screenX
                    : lineDraftStart.x * viewport.zoom + viewport.x
                }
                y2={
                  shapeCursorPosRef.current
                    ? shapeCursorPosRef.current.screenY
                    : lineDraftStart.y * viewport.zoom + viewport.y
                }
                stroke={shapeColor}
                strokeWidth={Math.max(0.4, 2.5 * viewport.zoom)}
                strokeLinecap="round"
                strokeDasharray="6 4"
              />
              <circle
                ref={customLinePreviewStartRef}
                cx={lineDraftStart.x * viewport.zoom + viewport.x}
                cy={lineDraftStart.y * viewport.zoom + viewport.y}
                r={Math.max(3, 4 * viewport.zoom)}
                fill={shapeColor}
              />
              <circle
                ref={customLinePreviewEndRef}
                cx={
                  shapeCursorPosRef.current
                    ? shapeCursorPosRef.current.screenX
                    : lineDraftStart.x * viewport.zoom + viewport.x
                }
                cy={
                  shapeCursorPosRef.current
                    ? shapeCursorPosRef.current.screenY
                    : lineDraftStart.y * viewport.zoom + viewport.y
                }
                r={Math.max(3, 4 * viewport.zoom)}
                fill={shapeColor}
              />
            </svg>
          ) : (
            <div
              ref={customLineCursorDotRef}
              className="absolute pointer-events-none z-40 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{
                left: `${shapeCursorPosRef.current?.screenX ?? -100}px`,
                top: `${shapeCursorPosRef.current?.screenY ?? -100}px`,
                backgroundColor: shapeColor,
              }}
            />
          )
        ) : (
          <div
            ref={shapeGhostPreviewRef}
            className="absolute pointer-events-none z-40 opacity-40 transition-none"
            style={{
              left: `${
                (shapeCursorPosRef.current?.screenX ?? -1000) -
                ((SHAPE_MAP.get(activeShapeType)?.defaultWidth || 120) * viewport.zoom) / 2
              }px`,
              top: `${
                (shapeCursorPosRef.current?.screenY ?? -1000) -
                ((SHAPE_MAP.get(activeShapeType)?.defaultHeight || 120) * viewport.zoom) / 2
              }px`,
              width: `${(SHAPE_MAP.get(activeShapeType)?.defaultWidth || 120) * viewport.zoom}px`,
              height: `${(SHAPE_MAP.get(activeShapeType)?.defaultHeight || 120) * viewport.zoom}px`,
            }}
          >
            {renderShapeSVG(
              activeShapeType,
              shapeColor,
              '100%',
              '100%',
              2.5,
              SHAPE_MAP.get(activeShapeType)?.defaultWidth || 120,
              SHAPE_MAP.get(activeShapeType)?.defaultHeight || 120,
              viewport.zoom
            )}
          </div>
        )
      )}

      {/* Marquee Area Selection DOM Overlay */}
      {marqueeRect && (
        <div
          className="absolute pointer-events-none z-20 border border-black border-dashed bg-black/[0.06] rounded-[2px]"
          style={{
            left: Math.min(marqueeRect.startX, marqueeRect.currentX) * viewport.zoom + viewport.x,
            top: Math.min(marqueeRect.startY, marqueeRect.currentY) * viewport.zoom + viewport.y,
            width: Math.abs(marqueeRect.currentX - marqueeRect.startX) * viewport.zoom,
            height: Math.abs(marqueeRect.currentY - marqueeRect.startY) * viewport.zoom,
          }}
        />
      )}

      {/* Layer 3: Shape Objects */}
      {shapes.map((shp) => (
        <BoardShapeElement
          key={shp.id}
          shape={shp}
          viewport={viewport}
          isInteractive={activeTool === 'select'}
          onSelect={(e) => {
            if (activeTool === 'select') {
              startDirectObjectDrag({ type: 'shape', id: shp.id }, e);
            }
          }}
        />
      ))}

      {/* Layer 4: Text Objects */}
      {texts.map((txt) => {
        const isSelected = selectedItems.some((i) => i.id === txt.id);
        const hasStrokes = selectedItems.some((i) => i.type === 'stroke');
        const activeCount = hasStrokes
          ? selectedItems.filter((i) => i.type !== 'image').length
          : selectedItems.length;
        const isInGroup = isSelected && activeCount > 1;

        return (
          <BoardTextElement
            key={txt.id}
            textObj={txt}
            isSelected={isSelected}
            isInGroup={isInGroup}
            isEditingDirectly={editingTextId === txt.id}
            isEraserActive={activeTool === 'eraser' || activeTool === 'shape'}
            zoom={viewport.zoom}
            viewportX={viewport.x}
            viewportY={viewport.y}
            onSelect={(e) => {
              if (activeTool === 'select') {
                startDirectObjectDrag({ type: 'text', id: txt.id }, e);
              }
            }}
            onUpdateText={handleUpdateText}
            onDelete={() => {
              const nextTexts = textsRef.current.filter((t) => t.id !== txt.id);
              textsRef.current = nextTexts;
              setTexts(nextTexts);
              setSelectedItems((prev) => prev.filter((i) => i.id !== txt.id));
              pushHistory(strokesRef.current, nextTexts, imagesRef.current, shapesRef.current);
            }}
            onFinishEditing={() => setEditingTextId(null)}
            onCommitHistory={commitHistory}
          />
        );
      })}

      {/* Layer 5: Selection Controls (Handles for Resize, Rotation, Move, Delete - only active in select mode) */}
      {activeTool === 'select' && (
        <BoardControls
          selectedItems={selectedItems}
          images={images}
          texts={texts}
          strokes={strokes}
          shapes={shapes}
          editingTextId={editingTextId}
          zoom={viewport.zoom}
          viewportX={viewport.x}
          viewportY={viewport.y}
          onUpdateImage={handleUpdateImage}
          onUpdateTextPos={handleUpdateTextPos}
          onUpdateStrokePoints={handleUpdateStrokePoints}
          onUpdateShape={handleUpdateShape}
          onUpdateMultipleAbsolute={handleUpdateMultipleAbsolute}
          onDeleteSelected={handleDeleteSelected}
          onEditText={(id) => setEditingTextId(id)}
          onCommitHistory={commitHistory}
        />
      )}
      </div>
    </div>
  );
};
