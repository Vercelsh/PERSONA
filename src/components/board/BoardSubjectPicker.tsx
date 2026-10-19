import React from 'react';
import { Subject, TaskItem } from '../../types';
import { ArrowRight, BookOpen, Layers } from 'lucide-react';

interface BoardSubjectPickerProps {
  subjects: Subject[];
  tasksBySubject: Record<string, TaskItem[]>;
  onSelectSubject: (subjectId: string) => void;
  onGoToSubjectsSection: () => void;
}

export const BoardSubjectPicker: React.FC<BoardSubjectPickerProps> = ({
  subjects,
  tasksBySubject,
  onSelectSubject,
  onGoToSubjectsSection,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-white/[0.06]">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Интерактивная доска
          </h1>
          <p className="text-sm text-neutral-400 mt-2">
            Выберите предмет и задание для перехода к индивидуальной рабочей доске.
          </p>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="mt-12 p-8 sm:p-12 text-center rounded-2xl border border-white/[0.06] bg-[#0c0c0c]/60 max-w-lg mx-auto">
          <BookOpen className="w-10 h-10 text-neutral-600 mx-auto mb-4 stroke-1" />
          <h3 className="text-base font-medium text-white mb-2">Список предметов пуст</h3>
          <p className="text-xs text-neutral-400 leading-relaxed mb-6">
            Предметы и задания берутся напрямую из раздела «Предметы». Добавьте свой первый предмет, и он сразу появится здесь.
          </p>
          <button
            onClick={onGoToSubjectsSection}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.14] rounded-lg border border-white/[0.1] transition-all"
          >
            <span>Перейти к предметам</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {subjects.map((subject) => {
            const tasks = tasksBySubject[subject.id] || [];
            const taskCount = tasks.length;

            return (
              <div
                key={subject.id}
                onClick={() => onSelectSubject(subject.id)}
                className="group relative p-5 rounded-2xl border border-white/[0.08] bg-[#0c0c0c] hover:bg-[#111111] hover:border-white/[0.18] transition-all cursor-pointer flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                      Предмет
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.04]">
                      {taskCount} {taskCount === 1 ? 'задание' : taskCount >= 2 && taskCount <= 4 ? 'задания' : 'заданий'}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium text-white group-hover:text-white transition-colors leading-snug line-clamp-2">
                    {subject.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/[0.04] mt-4 text-xs text-neutral-400 group-hover:text-white transition-colors">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Layers className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Доски заданий</span>
                  </div>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
