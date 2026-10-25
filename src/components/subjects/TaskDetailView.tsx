import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TaskItem, Subject, SolutionAttachment } from '../../types';
import { saveFileAttachment, getFileAttachment, deleteFileAttachment } from '../../lib/db';
import {
  ArrowLeft,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  RefreshCw,
  Plus,
  Pen,
} from 'lucide-react';

interface TaskDetailViewProps {
  task: TaskItem;
  subject: Subject;
  allTasks: TaskItem[];
  onBack: () => void;
  onSave: (updatedTask: TaskItem) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onSelectTask: (taskId: string) => void;
  onOpenBoard: (subjectId: string, taskId: string) => void;
}

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({
  task,
  subject,
  allTasks,
  onBack,
  onSave,
  onDelete,
  onSelectTask,
  onOpenBoard,
}) => {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [solutionText, setSolutionText] = useState(task.solutionText || '');

  // Example Attachment (Photo)
  const [exampleAttachment, setExampleAttachment] = useState<SolutionAttachment | null>(
    task.exampleAttachment || null
  );
  const [exampleUrl, setExampleUrl] = useState<string | null>(
    task.exampleAttachment?.dataUrl || null
  );

  // Template Attachment (Photo)
  const [templateAttachment, setTemplateAttachment] = useState<SolutionAttachment | null>(
    task.solutionAttachment || null
  );
  const [templateUrl, setTemplateUrl] = useState<string | null>(
    task.solutionAttachment?.dataUrl || null
  );

  // UI state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePhotoTarget, setDeletePhotoTarget] = useState<'example' | 'template' | null>(null);

  const exampleFileInputRef = useRef<HTMLInputElement>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep latest state in ref for safe synchronous flush on unmount or task switch
  const hasPendingChangesRef = useRef(false);
  const pendingStateRef = useRef({
    task,
    title,
    notes,
    solutionText,
    exampleAttachment,
    templateAttachment,
  });

  pendingStateRef.current = {
    task,
    title,
    notes,
    solutionText,
    exampleAttachment,
    templateAttachment,
  };

  // Helper to load example Data URL
  const loadExampleBlob = useCallback(async (att: SolutionAttachment | null) => {
    if (!att) {
      setExampleUrl(null);
      return;
    }

    if (att.dataUrl) {
      setExampleUrl(att.dataUrl);
      return;
    }

    if (att.fileId) {
      try {
        const stored = await getFileAttachment(att.fileId);
        if (stored && stored.blob) {
          const reader = new FileReader();
          reader.onload = () => {
            setExampleUrl(reader.result as string);
          };
          reader.readAsDataURL(stored.blob);
          return;
        }
      } catch (err) {
        console.warn('Не удалось загрузить фото примера:', err);
      }
    }
    setExampleUrl(null);
  }, []);

  // Helper to load template Data URL
  const loadTemplateBlob = useCallback(async (att: SolutionAttachment | null) => {
    if (!att) {
      setTemplateUrl(null);
      return;
    }

    if (att.dataUrl) {
      setTemplateUrl(att.dataUrl);
      return;
    }

    if (att.fileId) {
      try {
        const stored = await getFileAttachment(att.fileId);
        if (stored && stored.blob) {
          const reader = new FileReader();
          reader.onload = () => {
            setTemplateUrl(reader.result as string);
          };
          reader.readAsDataURL(stored.blob);
          return;
        }
      } catch (err) {
        console.warn('Не удалось загрузить фото шаблона:', err);
      }
    }
    setTemplateUrl(null);
  }, []);

  // Flush pending changes
  const flushSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (hasPendingChangesRef.current) {
      hasPendingChangesRef.current = false;
      const {
        task: curTask,
        title: curTitle,
        notes: curNotes,
        solutionText: curSolutionText,
        exampleAttachment: curExampleAtt,
        templateAttachment: curTemplateAtt,
      } = pendingStateRef.current;

      setSaveStatus('saving');
      const updated: TaskItem = {
        ...curTask,
        title: curTitle.trim() || `Задание ${curTask.taskNumber}`,
        notes: curNotes,
        solutionText: curSolutionText,
        exampleAttachment: curExampleAtt,
        solutionAttachment: curTemplateAtt,
        updatedAt: Date.now(),
      };
      try {
        await onSave(updated);
        setSaveStatus('saved');
      } catch (err) {
        hasPendingChangesRef.current = true;
        setSaveStatus('unsaved');
        console.error('Ошибка сохранения задания:', err);
      }
    }
  }, [onSave]);

  // Synchronize when task prop updates
  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes);
    setSolutionText(task.solutionText || '');
    setExampleAttachment(task.exampleAttachment || null);
    setTemplateAttachment(task.solutionAttachment || null);
    hasPendingChangesRef.current = false;
    setSaveStatus('saved');

    loadExampleBlob(task.exampleAttachment || null);
    loadTemplateBlob(task.solutionAttachment || null);
  }, [task.id, loadExampleBlob, loadTemplateBlob]);

  // Cleanup on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      void flushSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      void flushSave();
    };
  }, [flushSave]);

  // Debounced auto-save
  const triggerAutoSave = (
    newTitle: string,
    newNotes: string,
    newSolutionText: string,
    newExampleAtt: SolutionAttachment | null,
    newTemplateAtt: SolutionAttachment | null
  ) => {
    hasPendingChangesRef.current = true;
    pendingStateRef.current = {
      task,
      title: newTitle,
      notes: newNotes,
      solutionText: newSolutionText,
      exampleAttachment: newExampleAtt,
      templateAttachment: newTemplateAtt,
    };
    setSaveStatus('unsaved');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    saveTimeoutRef.current = setTimeout(async () => {
      saveTimeoutRef.current = null;
      await flushSave();
    }, 500);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    triggerAutoSave(val, notes, solutionText, exampleAttachment, templateAttachment);
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    triggerAutoSave(title, val, solutionText, exampleAttachment, templateAttachment);
  };

  const handleSolutionTextChange = (val: string) => {
    setSolutionText(val);
    triggerAutoSave(title, notes, val, exampleAttachment, templateAttachment);
  };

  // Upload Photo for Example
  const handleExampleFileUpload = async (file: File) => {
    const prevFileId = exampleAttachment?.fileId;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const fileId = `ex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await saveFileAttachment(fileId, file, file.name, file.type, file.size);

      const newAtt: SolutionAttachment = {
        fileId,
        name: file.name,
        type: file.type || 'image/png',
        size: file.size,
        dataUrl,
        uploadedAt: Date.now(),
      };

      setExampleAttachment(newAtt);
      setExampleUrl(dataUrl);
      triggerAutoSave(title, notes, solutionText, newAtt, templateAttachment);

      if (prevFileId && prevFileId !== fileId) {
        await deleteFileAttachment(prevFileId).catch(() => {});
      }

      if (exampleFileInputRef.current) {
        exampleFileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Ошибка сохранения фото примера:', err);
    }
  };

  const handleRemoveExample = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const prevFileId = exampleAttachment?.fileId;
    setExampleAttachment(null);
    setExampleUrl(null);
    triggerAutoSave(title, notes, solutionText, null, templateAttachment);
    if (prevFileId) {
      await deleteFileAttachment(prevFileId).catch(() => {});
    }
    if (exampleFileInputRef.current) {
      exampleFileInputRef.current.value = '';
    }
  };

  // Upload Photo for Template
  const handleTemplateFileUpload = async (file: File) => {
    const prevFileId = templateAttachment?.fileId;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const fileId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await saveFileAttachment(fileId, file, file.name, file.type, file.size);

      const newAtt: SolutionAttachment = {
        fileId,
        name: file.name,
        type: file.type || 'image/png',
        size: file.size,
        dataUrl,
        uploadedAt: Date.now(),
      };

      setTemplateAttachment(newAtt);
      setTemplateUrl(dataUrl);
      triggerAutoSave(title, notes, solutionText, exampleAttachment, newAtt);

      if (prevFileId && prevFileId !== fileId) {
        await deleteFileAttachment(prevFileId).catch(() => {});
      }

      if (templateFileInputRef.current) {
        templateFileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Ошибка сохранения фото шаблона:', err);
    }
  };

  const handleRemoveTemplate = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const prevFileId = templateAttachment?.fileId;
    setTemplateAttachment(null);
    setTemplateUrl(null);
    triggerAutoSave(title, notes, solutionText, exampleAttachment, null);
    if (prevFileId) {
      await deleteFileAttachment(prevFileId).catch(() => {});
    }
    if (templateFileInputRef.current) {
      templateFileInputRef.current.value = '';
    }
  };

  const handleBack = async () => {
    await flushSave();
    onBack();
  };

  const handleOpenBoard = async () => {
    await flushSave();
    onOpenBoard(subject.id, task.id);
  };

  const currentIndex = allTasks.findIndex((t) => t.id === task.id);
  const prevTask = currentIndex > 0 ? allTasks[currentIndex - 1] : null;
  const nextTask = currentIndex < allTasks.length - 1 ? allTasks[currentIndex + 1] : null;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors group px-2 py-1 -ml-2 rounded"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>{subject.title}</span>
          </button>
          <span className="text-neutral-600">/</span>
          <span className="text-sm font-medium text-neutral-300">{title}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Save Status Indicator + Quick Board Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-400">
              {saveStatus === 'saved' && (
                <>
                  <Check className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Сохранено локально</span>
                </>
              )}
              {saveStatus === 'saving' && (
                <span className="animate-pulse text-neutral-400">Сохранение...</span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="text-neutral-500">Несохранённые правки</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleOpenBoard}
              title="Открыть доску задания"
              aria-label="Открыть доску задания"
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <Pen className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Prev / Next navigation */}
          <div className="flex items-center gap-1 pl-3 border-l border-white/[0.08]">
            <button
              onClick={async () => {
                if (prevTask) {
                  await flushSave();
                  onSelectTask(prevTask.id);
                }
              }}
              disabled={!prevTask}
              title={prevTask ? `Перейти к: ${prevTask.title}` : undefined}
              className={`p-1.5 rounded text-neutral-400 transition-colors ${
                prevTask
                  ? 'hover:text-white hover:bg-white/[0.04]'
                  : 'opacity-20 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={async () => {
                if (nextTask) {
                  await flushSave();
                  onSelectTask(nextTask.id);
                }
              }}
              disabled={!nextTask}
              title={nextTask ? `Перейти к: ${nextTask.title}` : undefined}
              className={`p-1.5 rounded text-neutral-400 transition-colors ${
                nextTask
                  ? 'hover:text-white hover:bg-white/[0.04]'
                  : 'opacity-20 cursor-not-allowed'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Delete Task */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors rounded hover:bg-white/[0.04]"
            title="Удалить задание"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Task Editor Body */}
      <div className="mt-8 space-y-10">
        {/* Section: Task Title */}
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-neutral-500">
            Название задания
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Название задания"
            className="w-full text-2xl sm:text-3xl font-semibold tracking-tight text-white bg-transparent border-b border-transparent hover:border-white/[0.1] focus:border-white/[0.3] focus:outline-none py-1 transition-colors"
          />
        </div>

        {/* Section 1: Пример задания (сверху, фото в любом формате) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase tracking-wider text-neutral-500">
              Пример задания
            </label>
            <span className="text-xs text-neutral-600 font-mono">
              Фотография задания
            </span>
          </div>

          {exampleUrl ? (
            /* Вставленное фото занимает все место плашки. При наведении мышки сверху справа маленькие кнопки */
            <div className="group relative w-full rounded-2xl border border-white/[0.08] bg-[#090909] overflow-hidden transition-all duration-200 hover:border-white/[0.2]">
              <img
                src={exampleUrl}
                alt="Пример задания"
                className="w-full h-auto max-h-[650px] object-contain block mx-auto select-none"
              />

              {/* Hover actions: сверху справа плашки */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  type="button"
                  onClick={() => exampleFileInputRef.current?.click()}
                  title="Заменить фотографию"
                  className="p-1.5 rounded-lg bg-black/80 hover:bg-black text-neutral-300 hover:text-white border border-white/20 hover:border-white/40 shadow-lg backdrop-blur-md transition-all hover:scale-105"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletePhotoTarget('example');
                  }}
                  title="Удалить фотографию"
                  className="p-1.5 rounded-lg bg-black/80 hover:bg-red-950/80 text-neutral-300 hover:text-red-400 border border-white/20 hover:border-red-500/50 shadow-lg backdrop-blur-md transition-all hover:scale-105"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Пустая плашка для вставки фото */
            <div
              onClick={() => exampleFileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleExampleFileUpload(file);
              }}
              className="w-full rounded-2xl border border-dashed border-white/[0.12] hover:border-white/[0.3] bg-[#090909]/40 hover:bg-[#090909] p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center gap-3"
            >
              <div className="w-11 h-11 rounded-xl border border-white/[0.08] flex items-center justify-center group-hover:border-white/[0.25] group-hover:scale-105 transition-all text-neutral-400 group-hover:text-white bg-white/[0.02]">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">
                  Вставить фото примера задания
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Нажмите для выбора или перетащите фото (любой формат)
                </p>
              </div>
            </div>
          )}

          <input
            ref={exampleFileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleExampleFileUpload(file);
            }}
            className="hidden"
          />
        </div>

        {/* Section 2: Мои записи */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase tracking-wider text-neutral-500">
              Мои записи
            </label>
            <span className="text-xs text-neutral-600 font-mono">
              Наблюдения, ошибки, формулы, правила
            </span>
          </div>
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#090909] p-4 sm:p-5 focus-within:border-white/[0.25] transition-colors">
            <textarea
              rows={10}
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Ваши личные записи: наблюдения, формулы, правила, способы решения, частые ошибки..."
              className="w-full bg-transparent text-sm sm:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none resize-y leading-relaxed font-mono"
            />
          </div>
        </div>

        {/* Section 3: Шаблон (где можно вставить фото или написать вручную текстом) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase tracking-wider text-neutral-500">
              Шаблон
            </label>
            <div className="flex items-center gap-2">
              {!templateUrl && (
                <button
                  type="button"
                  onClick={() => templateFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-400 hover:text-white rounded border border-white/[0.08] hover:border-white/[0.2] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Вставить фото</span>
                </button>
              )}
              <span className="text-xs text-neutral-600 font-mono">
                Фото или текст
              </span>
            </div>
          </div>

          {/* Если вставлено фото шаблона: занимает все место плашки, сверху справа маленькие кнопки при hover */}
          {templateUrl && (
            <div className="group relative w-full rounded-2xl border border-white/[0.08] bg-[#090909] overflow-hidden transition-all duration-200 hover:border-white/[0.2]">
              <img
                src={templateUrl}
                alt="Шаблон решения"
                className="w-full h-auto max-h-[650px] object-contain block mx-auto select-none"
              />

              {/* Hover actions: сверху справа плашки */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  type="button"
                  onClick={() => templateFileInputRef.current?.click()}
                  title="Заменить фотографию"
                  className="p-1.5 rounded-lg bg-black/80 hover:bg-black text-neutral-300 hover:text-white border border-white/20 hover:border-white/40 shadow-lg backdrop-blur-md transition-all hover:scale-105"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletePhotoTarget('template');
                  }}
                  title="Удалить фотографию"
                  className="p-1.5 rounded-lg bg-black/80 hover:bg-red-950/80 text-neutral-300 hover:text-red-400 border border-white/20 hover:border-red-500/50 shadow-lg backdrop-blur-md transition-all hover:scale-105"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Поле для ручного ввода текста шаблона */}
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#090909] p-4 sm:p-5 focus-within:border-white/[0.25] transition-colors">
            <textarea
              rows={8}
              value={solutionText}
              onChange={(e) => handleSolutionTextChange(e.target.value)}
              placeholder="Напишите вручную текст шаблона, алгоритм решения или код..."
              className="w-full bg-transparent text-sm sm:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none resize-y leading-relaxed font-mono"
            />
          </div>

          <input
            ref={templateFileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleTemplateFileUpload(file);
            }}
            className="hidden"
          />
        </div>
      </div>

      {/* Delete Photo Confirmation Modal */}
      {deletePhotoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-white/[0.12] bg-[#0d0d0d] p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">
              {deletePhotoTarget === 'example' ? 'Удалить фото примера?' : 'Удалить фото шаблона?'}
            </h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Это действие безвозвратно удалит фотографию {deletePhotoTarget === 'example' ? 'примера задания' : 'шаблона решения'}.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletePhotoTarget(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white rounded border border-white/[0.08] hover:border-white/[0.2] transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deletePhotoTarget;
                  setDeletePhotoTarget(null);
                  if (target === 'example') {
                    await handleRemoveExample();
                  } else {
                    await handleRemoveTemplate();
                  }
                }}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600/80 hover:bg-red-600 rounded transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-white/[0.12] bg-[#0d0d0d] p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Удалить {title}?</h3>
            <p className="text-sm text-neutral-400">
              Это действие безвозвратно удалит задание, его пример, записи и шаблон.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white rounded border border-white/[0.08] hover:border-white/[0.2] transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  setShowDeleteConfirm(false);
                  await onDelete(task.id);
                  onBack();
                }}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600/80 hover:bg-red-600 rounded transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
