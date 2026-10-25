import React, { useState } from 'react';
import { Subject, TaskItem } from '../../types';
import { ArrowLeft, Search, FileText, ArrowRight, Image as ImageIcon } from 'lucide-react';

interface BoardTaskPickerProps {
  subject: Subject;
  tasks: TaskItem[];
  onBack: () => void;
  onSelectTask: (taskId: string) => void;
  onGoToSubject: () => void;
}

export const BoardTaskPicker: React.FC<BoardTaskPickerProps> = ({
  subject,
  tasks,
  onBack,
  onSelectTask,
  onGoToSubject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.title || '').toLowerCase().includes(q) ||
      String(t.taskNumber ?? '').includes(q) ||
      (t.notes || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors group w-fit"
        >
          <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform" />
          <span>Ко всем предметам</span>
        </button>

        {tasks.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по заданиям..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#121212] border border-white/[0.08] focus:border-white/30 rounded-lg text-xs text-white placeholder-neutral-500 outline-none transition-all"
            />
          </div>
        )}
      </div>

      {/* Title */}
      <div className="mt-6 mb-8">
        <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 uppercase tracking-wider mb-1">
          <span>Предмет</span>
          <span>•</span>
          <span>Выбор доски задания</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          {subject.title}
        </h2>
        <p className="text-xs text-neutral-400 mt-1.5">
          Каждое задание обладает своей независимой интерактивной доской с бесконечным холстом.
        </p>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-white/[0.06] bg-[#0c0c0c]/40 max-w-md mx-auto mt-8">
          <FileText className="w-9 h-9 text-neutral-600 mx-auto mb-3 stroke-1" />
          <h3 className="text-sm font-medium text-white mb-1.5">У этого предмета пока нет заданий</h3>
          <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
            Перейдите в раздел «Предметы» и добавьте задания (с условием, номерами и фото).
          </p>
          <button
            onClick={onGoToSubject}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.14] rounded-lg border border-white/[0.1] transition-all"
          >
            <span>Открыть карточку предмета</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-8 text-center text-xs text-neutral-500">
          По запросу «{searchQuery}» ничего не найдено
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredTasks.map((task) => {
            const hasImages = Boolean(task.exampleAttachment || task.solutionAttachment);

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="group relative p-4 rounded-xl border border-white/[0.08] bg-[#0c0c0c] hover:bg-[#121212] hover:border-white/[0.2] transition-all cursor-pointer flex flex-col justify-between min-h-[110px]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-white/90 border border-white/[0.04]">
                      № {task.taskNumber}
                    </span>
                    {hasImages && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
                        <ImageIcon className="w-3 h-3 text-neutral-400" />
                        <span>фото</span>
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-medium text-white group-hover:text-white transition-colors line-clamp-2">
                    {task.title || `Задание № ${task.taskNumber}`}
                  </h4>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.04] text-[11px] text-neutral-400 group-hover:text-white transition-colors">
                  <span>Открыть доску</span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
