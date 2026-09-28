import React, { useState, useMemo } from 'react';
import { Subject, CalendarEntry } from '../../types';
import {
  formatMonthYearRu,
  formatDurationRu,
  getWeeksForMonth,
  extractTaskNumbers,
  MonthWeekRange,
  getSystemLocalDateStr,
} from '../../lib/dateUtils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarSummaryProps {
  subjects: Subject[];
  entries: CalendarEntry[];
  initialYear?: number;
  initialMonth?: number; // 0-indexed
}

export const CalendarSummary: React.FC<CalendarSummaryProps> = ({
  subjects,
  entries,
  initialYear,
  initialMonth,
}) => {
  // Independent month & year state for Summary so it never affects the top calendar
  const [year, setYear] = useState<number>(() => {
    return initialYear ?? Number(getSystemLocalDateStr().split('-')[0]);
  });
  const [month, setMonth] = useState<number>(() => {
    return initialMonth ?? (Number(getSystemLocalDateStr().split('-')[1]) - 1);
  });

  // Selected week ID: null means "Весь месяц", or "week-1", "week-2", etc.
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  // Available weeks in current month
  const weeks = useMemo(() => {
    return getWeeksForMonth(year, month);
  }, [year, month]);

  // If month changes and selectedWeekId is no longer valid, reset to month view
  const currentWeek = useMemo(() => {
    if (!selectedWeekId) return null;
    return weeks.find((w) => w.id === selectedWeekId) || null;
  }, [weeks, selectedWeekId]);

  // Navigate months independently
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    if (month === 0) {
      setMonth(11);
      setYear((prev) => prev - 1);
    } else {
      setMonth((prev) => prev - 1);
    }
    setSelectedWeekId(null);
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    if (month === 11) {
      setMonth(0);
      setYear((prev) => prev + 1);
    } else {
      setMonth((prev) => prev + 1);
    }
    setSelectedWeekId(null);
  };

  // Subject lookup map
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  // Date range for filtering
  const { dateRangeStart, dateRangeEnd, periodTitle } = useMemo(() => {
    const monthStr = String(month + 1).padStart(2, '0');
    if (currentWeek) {
      return {
        dateRangeStart: currentWeek.startDateStr,
        dateRangeEnd: currentWeek.endDateStr,
        periodTitle: currentWeek.label,
      };
    }
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      dateRangeStart: `${year}-${monthStr}-01`,
      dateRangeEnd: `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
      periodTitle: formatMonthYearRu(year, month),
    };
  }, [year, month, currentWeek]);

  // Filter entries in range
  const filteredEntries = useMemo(() => {
    return entries.filter(
      (e) => e.date >= dateRangeStart && e.date <= dateRangeEnd
    );
  }, [entries, dateRangeStart, dateRangeEnd]);

  // Calculations
  const { totalMinutes, subjectStats } = useMemo(() => {
    let totalMins = 0;
    // Map of subjectId -> { minutes: number; taskStrings: string[] }
    const subMap = new Map<string, { minutes: number; taskStrings: string[] }>();

    filteredEntries.forEach((e) => {
      const entryMins = (e.durationHours || 0) * 60 + (e.durationMinutes || 0);
      totalMins += entryMins;

      const current = subMap.get(e.subjectId) || { minutes: 0, taskStrings: [] };
      current.minutes += entryMins;
      if (e.taskNumbers?.trim()) {
        current.taskStrings.push(e.taskNumbers.trim());
      }
      subMap.set(e.subjectId, current);
    });

    // Build ordered list based on user's subjects
    const stats: {
      subjectId: string;
      title: string;
      minutes: number;
      durationText: string;
      tasksList: string[];
    }[] = [];

    // First list subjects in user's subjects order
    subjects.forEach((s) => {
      const data = subMap.get(s.id);
      if (data && data.minutes > 0) {
        stats.push({
          subjectId: s.id,
          title: s.title,
          minutes: data.minutes,
          durationText: formatDurationRu(data.minutes),
          tasksList: extractTaskNumbers(data.taskStrings),
        });
      }
    });

    // Also check any subjects not in subjects array (e.g. deleted or legacy)
    subMap.forEach((data, sId) => {
      if (!subjects.some((s) => s.id === sId) && data.minutes > 0) {
        stats.push({
          subjectId: sId,
          title: 'Предмет',
          minutes: data.minutes,
          durationText: formatDurationRu(data.minutes),
          tasksList: extractTaskNumbers(data.taskStrings),
        });
      }
    });

    return {
      totalMinutes: totalMins,
      subjectStats: stats,
    };
  }, [filteredEntries, subjects]);

  const hasAnyTasks = useMemo(() => {
    return subjectStats.some((s) => s.tasksList.length > 0);
  }, [subjectStats]);

  return (
    <div className="mt-14 pt-10 border-t border-white/[0.08]">
      {/* Top Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Сводка
          </h2>
          <p className="text-xs text-neutral-400 font-mono mt-1">
            {periodTitle}
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#090909] p-0.5 self-start sm:self-auto">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-white/[0.04] transition-colors"
            title="Предыдущий месяц"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 text-xs font-medium text-white min-w-[130px] text-center select-none font-mono">
            {formatMonthYearRu(year, month)}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-white/[0.04] transition-colors"
            title="Следующий месяц"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Week Filter Controls */}
      <div className="flex flex-wrap items-center gap-1.5 pb-6">
        <button
          onClick={() => setSelectedWeekId(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            selectedWeekId === null
              ? 'text-white bg-white/[0.1] border border-white/[0.18]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03] border border-transparent'
          }`}
        >
          Весь месяц
        </button>

        {weeks.map((w) => (
          <button
            key={w.id}
            onClick={() => setSelectedWeekId(w.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedWeekId === w.id
                ? 'text-white bg-white/[0.1] border border-white/[0.18]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03] border border-transparent'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Content Display: Общее время, Предметы, Задания */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#090909] p-6 sm:p-7 shadow-2xl space-y-7">
        {totalMinutes === 0 ? (
          <div className="py-8 text-center text-neutral-500 font-mono text-xs">
            Нет записей за выбранный период
          </div>
        ) : (
          <>
            {/* 1. Общее время */}
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block mb-1">
                Общее время
              </span>
              <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-mono">
                {formatDurationRu(totalMinutes)}
              </p>
            </div>

            {/* 2. Предметы */}
            <div className="pt-6 border-t border-white/[0.06]">
              <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block mb-3">
                Предметы
              </span>
              <div className="space-y-2">
                {subjectStats.map((item) => (
                  <div
                    key={item.subjectId}
                    className="flex items-center justify-between text-sm py-1 border-b border-white/[0.02] last:border-0"
                  >
                    <span className="text-neutral-200 font-medium">
                      {item.title}
                    </span>
                    <span className="text-neutral-400 font-mono">
                      {item.durationText}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Задания */}
            {hasAnyTasks && (
              <div className="pt-6 border-t border-white/[0.06]">
                <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block mb-3">
                  Задания
                </span>
                <div className="space-y-2.5">
                  {subjectStats
                    .filter((item) => item.tasksList.length > 0)
                    .map((item) => (
                      <div
                        key={item.subjectId}
                        className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-sm py-1"
                      >
                        <span className="text-neutral-300 font-medium shrink-0">
                          {item.title} —
                        </span>
                        <span className="text-neutral-400 font-mono">
                          {item.tasksList.join(', ')}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
