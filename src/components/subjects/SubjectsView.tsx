import React, { useState } from 'react';
import { Subject, TaskItem } from '../../types';
import { Plus, ArrowRight, BookOpen, Trash2, Edit2, Check } from 'lucide-react';

interface SubjectsViewProps {
  subjects: Subject[];
  tasksBySubject: Record<string, TaskItem[]>;
  onSelectSubject: (subjectId: string) => void;
  onAddSubject: (title: string) => Promise<void>;
  onRenameSubject: (subjectId: string, newTitle: string) => Promise<void>;
  onDeleteSubject: (subjectId: string) => Promise<void>;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  subjects,
  tasksBySubject,
  onSelectSubject,
  onAddSubject,
  onRenameSubject,
  onDeleteSubject,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onAddSubject(newTitle.trim());
    setNewTitle('');
    setIsAdding(false);
  };

  const handleStartRename = (subject: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSubjectId(subject.id);
    setEditingTitle(subject.title);
  };

  const handleSaveRename = async (subjectId: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      await onRenameSubject(subjectId, editingTitle.trim());
    }
    setEditingSubjectId(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-white/[0.06]">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Предметы
          </h1>
          <p className="text-sm text-neutral-400 mt-2">
            Личные записи по заданиям ЕГЭ, условиям, наблюдениям и шаблонам решений.
          </p>
        </div>

        {subjects.length > 0 && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.14] rounded-lg border border-white/[0.1] transition-all hover:scale-[1.02] self-start sm:self-auto shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить предмет</span>
          </button>
        )}
      </div>

      {/* Add Subject Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#0c0c0c] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-white">Новый предмет</h3>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-neutral-500 hover:text-neutral-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-mono text-neutral-400 block mb-1">
                Название предмета
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Например, Физика или Обществознание"
                className="w-full bg-[#141414] text-white text-sm rounded-lg px-3.5 py-2 border border-white/[0.08] focus:border-white/[0.3] focus:outline-none"
                autoFocus
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-lg border border-white/[0.08] transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-black bg-white hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Добавить
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {subjectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.12] bg-[#0c0c0c] p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Удалить предмет?</h3>
            <p className="text-sm text-neutral-400">
              Вы уверены, что хотите удалить «{subjectToDelete.title}» и все связанные задания и записи?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSubjectToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white rounded-lg border border-white/[0.08] transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  const id = subjectToDelete.id;
                  setSubjectToDelete(null);
                  await onDeleteSubject(id);
                }}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600/80 hover:bg-red-600 rounded-lg transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subjects Grid or Empty State */}
      {subjects.length === 0 ? (
        <div className="mt-12 py-20 px-4 text-center rounded-2xl border border-dashed border-white/[0.1] bg-[#080808]">
          <div className="w-12 h-12 rounded-xl border border-white/[0.1] bg-white/[0.03] flex items-center justify-center text-neutral-400 mx-auto mb-4">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-medium text-white">Список предметов пуст</h3>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto mt-2 leading-relaxed">
            Начните вести подготовку с чистого листа: добавьте предмет (например, «Профильная математика», «Информатика» или «Русский язык»).
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-black bg-white hover:bg-neutral-200 rounded-lg transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить первый предмет</span>
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          {subjects.map((subject) => {
            const tasks = tasksBySubject[subject.id] || [];
            const tasksWithNotes = tasks.filter(
              (t) => t.notes?.trim() || t.example?.trim() || t.solutionAttachment
            ).length;

            const isEditing = editingSubjectId === subject.id;

            return (
              <div
                key={subject.id}
                onClick={() => onSelectSubject(subject.id)}
                className="group relative rounded-2xl border border-white/[0.08] bg-[#090909] hover:bg-[#0d0d0d] hover:border-white/[0.22] p-6 sm:p-7 cursor-pointer transition-all duration-300 flex flex-col justify-between min-h-[220px]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-neutral-400 group-hover:text-white transition-colors">
                      <BookOpen className="w-4 h-4" />
                    </div>

                    {/* Actions (Rename / Delete) */}
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => handleStartRename(subject, e)}
                        title="Переименовать"
                        className="p-1.5 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-white/[0.04]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubjectToDelete(subject);
                        }}
                        title="Удалить предмет"
                        className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors rounded hover:bg-white/[0.04]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  {isEditing ? (
                    <div className="mt-5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="flex-1 bg-[#141414] text-white text-base rounded px-2.5 py-1 border border-white/[0.2] focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={(e) => handleSaveRename(subject.id, e)}
                        className="p-1.5 bg-white text-black rounded hover:bg-neutral-200"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <h2 className="text-xl font-semibold text-white tracking-tight mt-5 group-hover:text-white transition-colors">
                      {subject.title}
                    </h2>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-xs font-mono text-neutral-400">
                    <span>{tasks.length} заданий</span>
                    <span>·</span>
                    <span className="text-neutral-400">{tasksWithNotes} с записями</span>
                  </div>
                </div>

                {/* Bottom footer in card */}
                <div className="mt-6 pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-neutral-400 group-hover:text-neutral-300 transition-colors">
                  <span>Открыть задания</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
