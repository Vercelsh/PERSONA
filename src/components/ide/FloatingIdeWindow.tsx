import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IdeProject } from '../../types/ide';
import { getIdeProject, saveIdeProject, createDefaultProject, addFileToProject } from '../../lib/ideStorage';
import { IdeTabs } from './IdeTabs';
import { CodeEditor } from './CodeEditor';
import {
  Code,
  Minus,
  Square,
  Copy,
  X,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';

interface FloatingIdeWindowProps {
  taskId: string;
  taskTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_WIDTH = 480;
const MIN_HEIGHT = 360;

export const FloatingIdeWindow: React.FC<FloatingIdeWindowProps> = ({
  taskId,
  taskTitle,
  isOpen,
  onClose,
}) => {
  const [project, setProject] = useState<IdeProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  // Window geometry state
  const [windowState, setWindowState] = useState<WindowState>(() => {
    const defaultWidth = Math.min(Math.max(window.innerWidth * 0.5, MIN_WIDTH), 720);
    const defaultHeight = Math.min(Math.max(window.innerHeight * 0.65, MIN_HEIGHT), 580);
    const defaultX = Math.max(window.innerWidth - defaultWidth - 40, 40);
    const defaultY = 70;
    return {
      x: defaultX,
      y: defaultY,
      width: defaultWidth,
      height: defaultHeight,
    };
  });

  const prevRestoredBoundsRef = useRef<WindowState>(windowState);
  const saveTimeoutRef = useRef<number | null>(null);

  // Dragging & Resizing refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{
    direction: string;
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  }>({
    direction: '',
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
  });

  // Load project on mount or taskId change
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const load = async () => {
      try {
        let loaded = await getIdeProject(taskId);
        if (!loaded) {
          loaded = createDefaultProject(taskId);
          await saveIdeProject(loaded);
        }
        if (isMounted) {
          setProject(loaded);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load IDE project:', err);
        if (isMounted) {
          setProject(createDefaultProject(taskId));
          setIsLoading(false);
        }
      }
    };

    if (isOpen) {
      load();
    }

    return () => {
      isMounted = false;
    };
  }, [taskId, isOpen]);

  // Debounced auto-save project
  const triggerAutoSave = useCallback((updatedProject: IdeProject) => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await saveIdeProject(updatedProject);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save IDE project:', err);
      }
    }, 400);
  }, []);

  // Update active file content
  const handleCodeChange = useCallback(
    (newContent: string) => {
      setProject((prev) => {
        if (!prev) return null;
        const updatedFiles = prev.files.map((file) =>
          file.id === prev.activeFileId ? { ...file, content: newContent } : file
        );
        const nextProject: IdeProject = {
          ...prev,
          files: updatedFiles,
          updatedAt: Date.now(),
        };
        triggerAutoSave(nextProject);
        return nextProject;
      });
    },
    [triggerAutoSave]
  );

  // File management
  const handleSelectFile = useCallback((fileId: string) => {
    setProject((prev) => {
      if (!prev) return null;
      const nextProject: IdeProject = { ...prev, activeFileId: fileId };
      saveIdeProject(nextProject).catch(console.error);
      return nextProject;
    });
  }, []);

  const handleAddFile = useCallback(
    (fileName: string) => {
      if (!project) return;
      const { project: nextProject } = addFileToProject(project, fileName, '# ' + fileName + '\n');
      setProject(nextProject);
      saveIdeProject(nextProject).catch(console.error);
    },
    [project]
  );

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      if (!project || project.files.length <= 1) return;
      const nextFiles = project.files.filter((f) => f.id !== fileId);
      const nextActiveId =
        project.activeFileId === fileId ? nextFiles[0].id : project.activeFileId;
      const nextProject: IdeProject = {
        ...project,
        files: nextFiles,
        activeFileId: nextActiveId,
        updatedAt: Date.now(),
      };
      setProject(nextProject);
      saveIdeProject(nextProject).catch(console.error);
    },
    [project]
  );

  const handleRenameFile = useCallback(
    (fileId: string, newName: string) => {
      if (!project) return;
      const nextFiles = project.files.map((f) =>
        f.id === fileId ? { ...f, name: newName } : f
      );
      const nextProject: IdeProject = {
        ...project,
        files: nextFiles,
        updatedAt: Date.now(),
      };
      setProject(nextProject);
      saveIdeProject(nextProject).catch(console.error);
    },
    [project]
  );

  // Window drag handlers
  const handleTitlePointerDown = (e: React.PointerEvent) => {
    if (isMaximized) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: windowState.x,
      startY: windowState.y,
    };
  };

  const handleTitlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || isMaximized) return;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    const maxX = window.innerWidth - 120;
    const maxY = window.innerHeight - 60;
    const nextX = Math.min(Math.max(dragStartRef.current.startX + deltaX, 0), maxX);
    const nextY = Math.min(Math.max(dragStartRef.current.startY + deltaY, 0), maxY);

    setWindowState((prev) => ({ ...prev, x: nextX, y: nextY }));
  };

  const handleTitlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Window resize handlers
  const handleResizePointerDown = (direction: string, e: React.PointerEvent) => {
    e.stopPropagation();
    if (isMaximized) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isResizingRef.current = true;
    resizeStartRef.current = {
      direction,
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: windowState.x,
      startY: windowState.y,
      startW: windowState.width,
      startH: windowState.height,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizingRef.current || isMaximized) return;
    const { direction, mouseX, mouseY, startX, startY, startW, startH } = resizeStartRef.current;
    const deltaX = e.clientX - mouseX;
    const deltaY = e.clientY - mouseY;

    let nextW = startW;
    let nextH = startH;
    let nextX = startX;
    let nextY = startY;

    if (direction.includes('e')) {
      nextW = Math.max(startW + deltaX, MIN_WIDTH);
    }
    if (direction.includes('s')) {
      nextH = Math.max(startH + deltaY, MIN_HEIGHT);
    }
    if (direction.includes('w')) {
      const rawW = startW - deltaX;
      if (rawW >= MIN_WIDTH) {
        nextW = rawW;
        nextX = startX + deltaX;
      }
    }
    if (direction.includes('n')) {
      const rawH = startH - deltaY;
      if (rawH >= MIN_HEIGHT) {
        nextH = rawH;
        nextY = startY + deltaY;
      }
    }

    setWindowState({
      x: nextX,
      y: nextY,
      width: nextW,
      height: nextH,
    });
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (isResizingRef.current) {
      isResizingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      setWindowState(prevRestoredBoundsRef.current);
      setIsMaximized(false);
    } else {
      prevRestoredBoundsRef.current = windowState;
      setWindowState({
        x: 10,
        y: 10,
        width: window.innerWidth - 20,
        height: window.innerHeight - 20,
      });
      setIsMaximized(true);
    }
  };

  if (!isOpen) return null;

  const activeFile = project?.files.find((f) => f.id === project.activeFileId) || project?.files[0];

  return (
    <div
      style={{
        left: isMinimized ? 20 : windowState.x,
        top: isMinimized ? window.innerHeight - 56 : windowState.y,
        width: isMinimized ? 280 : windowState.width,
        height: isMinimized ? 44 : windowState.height,
        position: 'absolute',
      }}
      className={`z-50 flex flex-col rounded-2xl bg-[#0c0c0c] border border-white/[0.14] shadow-2xl backdrop-blur-2xl transition-all duration-75 overflow-hidden select-none pointer-events-auto ${
        isMinimized ? 'shadow-lg' : ''
      }`}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* WINDOW TITLE BAR */}
      <div
        onPointerDown={handleTitlePointerDown}
        onPointerMove={handleTitlePointerMove}
        onPointerUp={handleTitlePointerUp}
        onDoubleClick={toggleMaximize}
        className="flex items-center justify-between px-3 h-10 bg-[#141414] border-b border-white/[0.08] cursor-move select-none shrink-0"
      >
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs font-semibold text-white">
            <Code className="w-3.5 h-3.5 text-amber-400" />
            <span>Python IDE</span>
          </div>

          {taskTitle && (
            <span className="text-[11px] text-neutral-400 truncate max-w-[140px] sm:max-w-[200px]" title={taskTitle}>
              {taskTitle}
            </span>
          )}

          <div className="flex items-center gap-1 text-[10px] text-neutral-500 ml-1">
            {saveStatus === 'saved' ? (
              <span className="flex items-center gap-0.5 text-neutral-400">
                <Check className="w-3 h-3 text-emerald-400" /> Сохранено
              </span>
            ) : (
              <span className="text-amber-400">Сохранение...</span>
            )}
          </div>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => setIsMinimized((prev) => !prev)}
            title={isMinimized ? 'Развернуть окно' : 'Свернуть окно'}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleMaximize}
            title={isMaximized ? 'Восстановить размер' : 'Во весь экран'}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
          </button>

          <button
            onClick={onClose}
            title="Закрыть IDE"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* WINDOW BODY (hidden if minimized) */}
      {!isMinimized && (
        <div className="flex-1 flex flex-col min-h-0 relative bg-[#0a0a0a]">
          {/* File Tabs */}
          {project && (
            <IdeTabs
              files={project.files}
              activeFileId={project.activeFileId}
              onSelectFile={handleSelectFile}
              onAddFile={handleAddFile}
              onDeleteFile={handleDeleteFile}
              onRenameFile={handleRenameFile}
            />
          )}

          {/* Code Editor Main View */}
          <div className="flex-1 min-h-0 relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-xs text-neutral-500">
                Загрузка проекта...
              </div>
            ) : activeFile ? (
              <CodeEditor
                key={activeFile.id}
                value={activeFile.content}
                language={activeFile.language}
                fileName={activeFile.name}
                onChange={handleCodeChange}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-neutral-500">
                Нет открытых файлов
              </div>
            )}
          </div>

          {/* Quick Execution Bar Preview (Stage 2 UX placeholder) */}
          <div className="h-8 bg-[#111111] border-t border-white/[0.08] px-3 flex items-center justify-between text-xs text-neutral-400 shrink-0">
            <div className="flex items-center gap-2">
              <button
                disabled
                title="Запуск Python будет активирован на следующем этапе"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.06] text-neutral-400 border border-white/[0.08] text-[11px] cursor-not-allowed opacity-80"
              >
                <Play className="w-3 h-3 text-emerald-400" />
                <span>Запуск (F5)</span>
              </button>

              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                {activeFile?.language === 'python' ? 'Python 3' : 'Текстовый файл'}
              </span>
            </div>

            <div className="text-[10px] text-neutral-400 font-mono">
              {activeFile?.name} • UTF-8
            </div>
          </div>
        </div>
      )}

      {/* RESIZE HANDLERS (border hitboxes) */}
      {!isMinimized && !isMaximized && (
        <>
          <div
            onPointerDown={(e) => handleResizePointerDown('e', e)}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute top-0 right-0 w-2 h-full cursor-e-resize"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown('s', e)}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute bottom-0 left-0 h-2 w-full cursor-s-resize"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown('se', e)}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-10"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown('w', e)}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute top-0 left-0 w-2 h-full cursor-w-resize"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown('sw', e)}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-10"
          />
        </>
      )}
    </div>
  );
};
