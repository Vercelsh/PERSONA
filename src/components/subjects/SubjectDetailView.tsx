import React, { useState } from 'react';
import { Subject, TaskItem } from '../../types';
import { ArrowLeft, Plus, Search, FileText, Paperclip } from 'lucide-react';

interface SubjectDetailViewProps {
  subject: Subject;
  tasks: TaskItem[];
  onBack: () => void;
  onSelectTask: (taskId: string) => void;
  onAddTask: (title: string, taskNumber: number) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onRenameSubject?: (newTitle: string) => Promise<void>;
}

export const SubjectDetailView: React.FC<SubjectDetailViewProps> = ({
  subject,
  tasks,
  onBack,
  onSelectTask,
  onAddTask,
  onDeleteTask,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskNumber, setNewTaskNumber] = useState<number>(() => {
    const maxNum = tasks.reduce((max, t) => Math.max(max, t.taskNumber || 0), 0);
    return maxNum + 1;
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.taskNumber.toString().includes(q) ||
      t.notes.toLowerCase().includes(q) ||
      t.example.toLowerCase().includes(q) ||
      (t.solutionText && t.solutionText.toLowerCase().includes(q))
    );
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = newTaskTitle.trim() || `Задание ${newTaskNumber}`;
    await onAddTask(finalTitle, newTaskNumber);
    setIsAddingTask(false);
    setNewTaskTitle('');
    setNewTaskNumber((prev) => prev + 1);
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors group w-fit"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Все предметы</span>
        </button>

        {tasks.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const maxNum = tasks.reduce((max, t) => Math.max(max, t.taskNumber || 0), 0);
                setNewTaskNumber(maxNum + 1);
                setNewTaskTitle(`Задание ${maxNum + 1}`);
                setIsAddingTask(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.14] rounded-lg border border-white/[0.1] transition-all hover:scale-[1.02]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить задание</span>
            </button>
          </div>
        )}
      </div>

      {/* Subject Header */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white uppercase">
            {subject.title}
          </h1>
          <p className="text-sm text-neutral-400 mt-2 font-mono">
            {tasks.length} {tasks.length === 1 ? 'задание' : tasks.length < 5 ? 'задания' : 'заданий'} в блокноте
          </p>
        </div>

        {/* Search / Filter */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по номеру или тексту..."
            className="w-full bg-[#0a0a0a] text-sm text-neutral-200 placeholder-neutral-500 rounded-lg pl-9 pr-4 py-2 border border-white/[0.08] focus:border-white/[0.25] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Task Creation Modal */}
      {isAddingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#0c0c0c] p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-white">Новое задание</h3>
              <button
                type="button"
                onClick={() => setIsAddingTask(false)}
                className="text-neutral-500 hover:text-neutral-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-neutral-400 block mb-1">
                  Номер задания
                </label>
                <input
                  type="number"
                  min="1"
                  value={newTaskNumber}
                  onChange={(e) => {
                    const num = parseInt(e.target.value) || 1;
                    setNewTaskNumber(num);
                    if (!newTaskTitle || newTaskTitle.startsWith('Задание ')) {
                      setNewTaskTitle(`Задание ${num}`);
                    }
                  }}
                  className="w-full bg-[#141414] text-white text-sm rounded-lg px-3.5 py-2 border border-white/[0.08] focus:border-white/[0.3] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-mono text-neutral-400 block mb-1">
                  Название
                </label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder={`Задание ${newTaskNumber}`}
                  className="w-full bg-[#141414] text-white text-sm rounded-lg px-3.5 py-2 border border-white/[0.08] focus:border-white/[0.3] focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingTask(false)}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-lg border border-white/[0.08] hover:border-white/[0.15] transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-black bg-white hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Создать
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tasks Grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full py-16 text-center border border-dashed border-white/[0.08] rounded-2xl">
            <FileText className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
            <p className="text-sm text-neutral-400">
              {searchQuery ? 'Заданий по запросу не найдено' : 'В этом предмете пока нет заданий'}
            </p>
            <button
              onClick={() => setIsAddingTask(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-300 hover:text-white rounded border border-white/[0.1] hover:border-white/[0.2] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать задание</span>
            </button>
          </div>
        ) : (
          filteredTasks.map((t) => {
            const hasNotes = Boolean(t.notes?.trim());
            const hasExample = Boolean(t.exampleAttachment || t.example?.trim());
            const hasFile = Boolean(t.solutionAttachment || t.solutionText?.trim());

            return (
              <div
                key={t.id}
                onClick={() => onSelectTask(t.id)}
                className="group relative rounded-xl border border-white/[0.07] bg-[#090909] hover:bg-[#0d0d0d] hover:border-white/[0.2] p-5 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[140px]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono text-neutral-500 group-hover:text-neutral-400 transition-colors">
                      № {t.taskNumber}
                    </span>

                    {/* Indicators */}
                    <div className="flex items-center gap-1.5">
                      {hasFile && (
                        <span title="Прикреплён шаблон решения" className="text-neutral-400">
                          <Paperclip className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {hasNotes && (
                        <span title="Есть личные записи" className="text-neutral-400">
                          <FileText className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-medium text-neutral-100 group-hover:text-white mt-2 transition-colors">
                    {t.title}
                  </h3>

                  {/* Snippet preview */}
                  <p className="text-xs text-neutral-400 mt-2 line-clamp-2 leading-relaxed">
                    {hasNotes
                      ? t.notes
                      : hasExample
                      ? t.example
                      : 'Нет записей. Нажмите, чтобы добавить условие, заметки или шаблон.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-mono text-[11px]">
                    {hasNotes || hasExample || hasFile ? 'Заполнено' : 'Пусто'}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-300">
                    Открыть →
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
