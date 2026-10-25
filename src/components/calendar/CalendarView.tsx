import React, { useState, useMemo, useEffect } from 'react';
import { Subject, CalendarEntry } from '../../types';
import {
  MONTH_NAMES_NOMINATIVE,
  WEEKDAY_NAMES_RU,
  getSystemLocalDateStr,
  formatDateRu,
  formatMonthYearRu,
  formatDurationRu,
} from '../../lib/dateUtils';
import { CalendarSummary } from './CalendarSummary';
import { ChevronLeft, ChevronRight, Plus, Clock, Edit2, Trash2, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarViewProps {
  subjects: Subject[];
  entries: CalendarEntry[];
  onAddEntry: (entry: Omit<CalendarEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateEntry: (entry: CalendarEntry) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  subjects,
  entries,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
}) => {
  const [todayDateStr, setTodayDateStr] = useState<string>(() => getSystemLocalDateStr());

  // Dynamically track system's local calendar day across midnight and window focus
  useEffect(() => {
    const syncSystemDate = () => {
      const sysToday = getSystemLocalDateStr();
      setTodayDateStr((prev) => (prev !== sysToday ? sysToday : prev));
    };

    window.addEventListener('focus', syncSystemDate);
    const interval = setInterval(syncSystemDate, 30000);

    return () => {
      window.removeEventListener('focus', syncSystemDate);
      clearInterval(interval);
    };
  }, []);

  const [currentYear, setCurrentYear] = useState<number>(() => {
    return Number(getSystemLocalDateStr().split('-')[0]);
  });
  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    return Number(getSystemLocalDateStr().split('-')[1]) - 1;
  }); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string>(() => getSystemLocalDateStr());

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Form fields
  const [formSubjectId, setFormSubjectId] = useState<string>(subjects[0]?.id || '');
  const [formHours, setFormHours] = useState<number>(1);
  const [formMinutes, setFormMinutes] = useState<number>(0);
  const [formTasks, setFormTasks] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Map subjects by ID for easy lookup
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    entries.forEach((e) => {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    });
    return map;
  }, [entries]);

  // Selected date entries
  const selectedEntries = useMemo(() => {
    return entriesByDate.get(selectedDate) || [];
  }, [entriesByDate, selectedDate]);

  // Calculate total time for selected day
  const totalDayTime = useMemo(() => {
    let totalMinutes = 0;
    selectedEntries.forEach((e) => {
      totalMinutes += (e.durationHours || 0) * 60 + (e.durationMinutes || 0);
    });
    if (totalMinutes === 0) return null;
    return formatDurationRu(totalMinutes);
  }, [selectedEntries]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleGoToday = () => {
    const sysToday = getSystemLocalDateStr();
    setTodayDateStr(sysToday);
    const [y, m] = sysToday.split('-').map(Number);
    setCurrentYear(y);
    setCurrentMonth(m - 1);
    setSelectedDate(sysToday);
  };

  // Generate calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Day of week for 1st day (0 = Sunday, 1 = Monday, ... 6 = Saturday)
    // Convert to Monday = 0, ..., Sunday = 6
    let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();

    // Previous month padding
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const m = currentMonth === 0 ? 12 : currentMonth;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({ dateStr, dayNumber: dayNum, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNumber: i, isCurrentMonth: true });
    }

    // Next month padding to fill grid (multiple of 7)
    const totalFilled = days.length;
    const remaining = totalFilled % 7 === 0 ? 0 : 7 - (totalFilled % 7);
    for (let i = 1; i <= remaining; i++) {
      const m = currentMonth === 11 ? 1 : currentMonth + 2;
      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNumber: i, isCurrentMonth: false });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Open form for new entry
  const handleOpenAdd = () => {
    setEditingEntryId(null);
    setFormSubjectId(subjects[0]?.id || '');
    setFormHours(1);
    setFormMinutes(0);
    setFormTasks('');
    setFormNotes('');
    setIsFormOpen(true);
  };

  // Open form for editing
  const handleOpenEdit = (entry: CalendarEntry) => {
    setEditingEntryId(entry.id);
    const hasSubject = subjects.some((s) => s.id === entry.subjectId);
    setFormSubjectId(hasSubject ? entry.subjectId : subjects[0]?.id || '');
    const safeHours = Math.min(24, Math.max(0, Math.floor(Number(entry.durationHours) || 0)));
    const safeMinutes =
      safeHours >= 24 ? 0 : Math.min(59, Math.max(0, Math.floor(Number(entry.durationMinutes) || 0)));
    setFormHours(safeHours);
    setFormMinutes(safeMinutes);
    setFormTasks(entry.taskNumbers);
    setFormNotes(entry.notes);
    setIsFormOpen(true);
  };

  // Save entry handler
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubjectId) return;

    const safeHours = Math.min(24, Math.max(0, Math.floor(Number(formHours) || 0)));
    const safeMinutes =
      safeHours >= 24 ? 0 : Math.min(59, Math.max(0, Math.floor(Number(formMinutes) || 0)));

    if (editingEntryId) {
      const existing = entries.find((x) => x.id === editingEntryId);
      if (existing) {
        await onUpdateEntry({
          ...existing,
          subjectId: formSubjectId,
          durationHours: safeHours,
          durationMinutes: safeMinutes,
          taskNumbers: formTasks.trim(),
          notes: formNotes.trim(),
          updatedAt: Date.now(),
        });
      }
    } else {
      await onAddEntry({
        date: selectedDate,
        subjectId: formSubjectId,
        durationHours: safeHours,
        durationMinutes: safeMinutes,
        taskNumbers: formTasks.trim(),
        notes: formNotes.trim(),
      });
    }

    setIsFormOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-white/[0.06]">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Календарь
          </h1>
          <p className="text-sm text-neutral-400 mt-2">
            Ручная фиксация времени, предметов и выполненных заданий.
          </p>
        </div>

        {/* Month Navigation Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleGoToday}
            className="px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white rounded-lg border border-white/[0.08] hover:border-white/[0.2] transition-colors"
          >
            Сегодня
          </button>
          <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#090909] p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-white/[0.04] transition-colors"
              title="Предыдущий месяц"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-medium text-white min-w-[130px] text-center select-none font-mono">
              {formatMonthYearRu(currentYear, currentMonth)}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-white/[0.04] transition-colors"
              title="Следующий месяц"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar Left, Selected Day Right */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Calendar Matrix (7 columns) */}
        <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-[#090909] p-3 sm:p-6 shadow-2xl">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-3 text-center">
            {WEEKDAY_NAMES_RU.map((day) => (
              <div
                key={day}
                className="text-xs font-mono text-neutral-500 py-1 font-medium select-none"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map(({ dateStr, dayNumber, isCurrentMonth }) => {
              const dayEntries = entriesByDate.get(dateStr) || [];
              const hasEntries = dayEntries.length > 0;
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === todayDateStr;

              // Calculate total minutes for the cell badge
              let cellTotalMinutes = 0;
              if (hasEntries) {
                dayEntries.forEach((e) => {
                  cellTotalMinutes += (e.durationHours || 0) * 60 + (e.durationMinutes || 0);
                });
              }
              const cellHours = Math.floor(cellTotalMinutes / 60);
              const cellMins = cellTotalMinutes % 60;
              const cellTimeLabel = cellHours > 0 ? `${cellHours}ч` : `${cellMins}м`;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`relative flex flex-col items-center justify-between p-2 sm:p-2.5 min-h-[58px] sm:min-h-[72px] rounded-xl border text-center transition-all duration-200 select-none ${
                    isSelected
                      ? 'border-white bg-white/[0.08] shadow-[0_0_15px_rgba(255,255,255,0.06)]'
                      : isToday
                      ? 'border-white/30 bg-white/[0.03]'
                      : 'border-transparent hover:border-white/[0.12] hover:bg-white/[0.02]'
                  } ${!isCurrentMonth ? 'opacity-25' : 'opacity-100'}`}
                >
                  <div className="relative flex items-center justify-center w-full">
                    <span
                      className={`text-xs sm:text-sm font-medium ${
                        isSelected
                          ? 'text-white font-semibold'
                          : isToday
                          ? 'text-white'
                          : 'text-neutral-300'
                      }`}
                    >
                      {dayNumber}
                    </span>

                    {/* Subtle dot indicator if day has entries */}
                    {hasEntries && (
                      <span className="absolute right-0 sm:right-1 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                    )}
                  </div>

                  {/* Centered time badge */}
                  {hasEntries && isCurrentMonth ? (
                    <span className="text-[10px] font-mono text-neutral-400 mt-1 truncate text-center w-full">
                      {cellTimeLabel}
                    </span>
                  ) : (
                    <span className="h-3 sm:h-3.5 block" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div className="lg:col-span-5 rounded-2xl border border-white/[0.08] bg-[#090909] p-6 shadow-2xl flex flex-col justify-between">
          <div>
            {/* Day Header with correct Russian date declension */}
            <div className="flex items-start justify-between gap-3 pb-5 border-b border-white/[0.06]">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                  Выбранный день
                </span>
                <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight mt-1">
                  {formatDateRu(selectedDate)}
                </h2>
                {selectedDate === todayDateStr && (
                  <span className="text-xs font-mono text-neutral-400 mt-0.5 block">
                    (Сегодня)
                  </span>
                )}
              </div>

              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.15] rounded-lg border border-white/[0.1] transition-all hover:scale-[1.02] shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить запись</span>
              </button>
            </div>

            {/* Day Summary (Total Time & Tasks) */}
            {totalDayTime && (
              <div className="my-5 p-4 rounded-xl border border-white/[0.06] bg-black/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400 font-mono">Общее время занятий:</span>
                  <span className="font-mono font-medium text-white text-sm">{totalDayTime}</span>
                </div>
                {/* List of distinct tasks mentioned this day */}
                {selectedEntries.some((e) => e.taskNumbers?.trim()) && (
                  <div className="pt-2 border-t border-white/[0.04] text-xs text-neutral-400">
                    <span className="font-mono text-neutral-500 block mb-1">Выполненные задания:</span>
                    <div className="space-y-1">
                      {selectedEntries
                        .filter((e) => e.taskNumbers?.trim())
                        .map((e) => {
                          const subj = subjectMap.get(e.subjectId)?.title || 'Предмет';
                          return (
                            <div key={e.id} className="flex items-start gap-2">
                              <span className="text-neutral-300 font-medium">{subj}:</span>
                              <span className="text-neutral-400 font-mono">{e.taskNumbers}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Entries List */}
            <div className="space-y-3 mt-4">
              {selectedEntries.length === 0 ? (
                <div className="py-12 text-center text-neutral-500">
                  <CalendarIcon className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                  <p className="text-sm text-neutral-400">Нет записей за этот день</p>
                  <p className="text-xs text-neutral-600 mt-1">
                    Нажмите «Добавить запись», чтобы зафиксировать время и выполненные задания.
                  </p>
                </div>
              ) : (
                selectedEntries.map((entry) => {
                  const subj = subjectMap.get(entry.subjectId);
                  const subjTitle = subj?.title || 'Предмет';
                  const entryDuration =
                    (entry.durationHours || 0) * 60 + (entry.durationMinutes || 0);

                  return (
                    <div
                      key={entry.id}
                      className="group rounded-xl border border-white/[0.06] bg-black/40 hover:bg-black/60 hover:border-white/[0.15] p-4 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-white tracking-tight">
                            {subjTitle}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400 font-mono">
                            <Clock className="w-3 h-3 text-neutral-500" />
                            <span>{formatDurationRu(entryDuration)}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEdit(entry)}
                            title="Редактировать запись"
                            className="p-1 text-neutral-500 hover:text-white rounded hover:bg-white/[0.04] transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteEntry(entry.id)}
                            title="Удалить запись"
                            className="p-1 text-neutral-500 hover:text-red-400 rounded hover:bg-white/[0.04] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Tasks mentioned */}
                      {entry.taskNumbers && (
                        <div className="mt-2 text-xs">
                          <span className="text-neutral-500">Задания: </span>
                          <span className="text-neutral-300 font-mono">{entry.taskNumbers}</span>
                        </div>
                      )}

                      {/* Personal note */}
                      {entry.notes && (
                        <div className="mt-2 pt-2 border-t border-white/[0.04] text-xs text-neutral-400 leading-relaxed font-sans">
                          {entry.notes}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly & Weekly Study Activity Summary */}
      <CalendarSummary
        subjects={subjects}
        entries={entries}
        initialYear={currentYear}
        initialMonth={currentMonth}
      />

      {/* Add / Edit Entry Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSaveForm}
            className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#0c0c0c] p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-white">
                  {editingEntryId ? 'Редактировать запись' : 'Добавить запись о занятии'}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                  {formatDateRu(selectedDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-neutral-500 hover:text-neutral-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Subject selector */}
              <div>
                <label className="text-xs font-mono text-neutral-400 block mb-1">
                  Предмет
                </label>
                {subjects.length > 0 ? (
                  <select
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(e.target.value)}
                    className="w-full bg-[#141414] text-white text-sm rounded-lg px-3.5 py-2 border border-white/[0.08] focus:border-white/[0.3] focus:outline-none"
                    required
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-lg border border-dashed border-white/[0.1] bg-[#141414] text-xs text-neutral-400">
                    Сначала добавьте хотя бы один предмет в разделе «Предметы», чтобы связывать занятия с предметом.
                  </div>
                )}
              </div>

              {/* Time inputs: Hours and Minutes */}
              <div>
                <label className="text-xs font-mono text-neutral-400 block mb-1">
                  Время занятия
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 bg-[#141414] rounded-lg px-3 py-2 border border-white/[0.08]">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={formHours}
                      onChange={(e) => {
                        const nextHours = Math.min(24, Math.max(0, parseInt(e.target.value, 10) || 0));
                        setFormHours(nextHours);
                        if (nextHours >= 24) {
                          setFormMinutes(0);
                        }
                      }}
                      className="w-full bg-transparent text-white text-sm focus:outline-none font-mono"
                    />
                    <span className="text-xs text-neutral-500 font-mono">часов</span>
                  </div>

                  <div className="flex items-center gap-2 bg-[#141414] rounded-lg px-3 py-2 border border-white/[0.08]">
                    <input
                      type="number"
                      min="0"
                      max={formHours >= 24 ? 0 : 59}
                      disabled={formHours >= 24}
                      value={formHours >= 24 ? 0 : formMinutes}
                      onChange={(e) => {
                        if (formHours >= 24) {
                          setFormMinutes(0);
                          return;
                        }
                        setFormMinutes(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)));
                      }}
                      className="w-full bg-transparent text-white text-sm focus:outline-none font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <span className="text-xs text-neutral-500 font-mono">минут</span>
                  </div>
                </div>
              </div>

              {/* Task numbers */}
              <div>
                <label className="text-xs font-mono text-neutral-400 block mb-1">
                  Выполненные задания
                </label>
                <input
                  type="text"
                  value={formTasks}
                  onChange={(e) => setFormTasks(e.target.value)}
                  placeholder="например: № 5, № 8, № 12"
                  className="w-full bg-[#141414] text-white text-sm rounded-lg px-3.5 py-2 border border-white/[0.08] focus:border-white/[0.3] focus:outline-none"
                />
              </div>

              {/* Personal notes */}
              <div>
                <label className="text-xs font-mono text-neutral-400 block mb-1">
                  Заметка к занятию
                </label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Любой ваш комментарий к занятию..."
                  className="w-full bg-[#141414] text-white text-sm rounded-lg px-3.5 py-2 border border-white/[0.08] focus:border-white/[0.3] focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-lg border border-white/[0.08] transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-black bg-white hover:bg-neutral-200 rounded-lg transition-colors"
              >
                {editingEntryId ? 'Сохранить изменения' : 'Добавить запись'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
