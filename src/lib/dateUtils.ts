export const MONTH_NAMES_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
] as const;

export const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
] as const;

export const WEEKDAY_NAMES_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

/**
 * Gets the system's local calendar date string "YYYY-MM-DD" based on the user device's local clock
 */
export function getSystemLocalDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats day and month with correct Russian genitive declension:
 * e.g. (26, 8) -> "26 сентября"
 * e.g. (1, 9) -> "1 октября"
 */
export function formatDayMonthRu(day: number, monthIndex: number): string {
  const genitiveMonth = MONTH_NAMES_GENITIVE[monthIndex] || '';
  return `${day} ${genitiveMonth}`;
}

/**
 * Formats "YYYY-MM-DD" to Russian date:
 * e.g. "2026-09-26" -> "26 сентября" (or "26 сентября 2026 г.")
 */
export function formatDateRu(dateStr: string, options: { includeYear?: boolean } = {}): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const monthIndex = month - 1;
  const base = formatDayMonthRu(day, monthIndex);
  if (options.includeYear) {
    return `${base} ${year} г.`;
  }
  return base;
}

/**
 * Formats Month and Year in nominative:
 * e.g. (2026, 8) -> "Сентябрь 2026"
 */
export function formatMonthYearRu(year: number, monthIndex: number): string {
  const monthName = MONTH_NAMES_NOMINATIVE[monthIndex] || '';
  return `${monthName} ${year}`;
}

/**
 * Formats minutes into human-readable hours and minutes:
 * e.g. 150 -> "2 ч 30 мин"
 * e.g. 60 -> "1 ч"
 * e.g. 45 -> "45 мин"
 * e.g. 0 -> "0 мин"
 */
export function formatDurationRu(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0 мин';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}

/**
 * Formats file size in bytes to clean Russian label:
 * e.g. 1024 -> "1.0 КБ"
 */
export function formatFileSizeRu(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 Б';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export interface MonthWeekRange {
  id: string; // e.g. "week-1"
  startDay: number;
  endDay: number;
  label: string; // e.g. "1–7 сентября"
  startDateStr: string; // "2026-09-01"
  endDateStr: string; // "2026-09-07"
}

/**
 * Computes standard 7-day calendar week chunks within a month:
 * 1–7, 8–14, 15–21, 22–28, 29–end
 */
export function getWeeksForMonth(year: number, monthIndex: number): MonthWeekRange[] {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const monthStr = String(monthIndex + 1).padStart(2, '0');
  const genitiveMonth = MONTH_NAMES_GENITIVE[monthIndex];

  const intervals = [
    { start: 1, end: Math.min(7, lastDay) },
    { start: 8, end: Math.min(14, lastDay) },
    { start: 15, end: Math.min(21, lastDay) },
    { start: 22, end: Math.min(28, lastDay) },
  ];

  if (lastDay >= 29) {
    intervals.push({ start: 29, end: lastDay });
  }

  return intervals.map((intv, index) => {
    const startPad = String(intv.start).padStart(2, '0');
    const endPad = String(intv.end).padStart(2, '0');
    return {
      id: `week-${index + 1}`,
      startDay: intv.start,
      endDay: intv.end,
      label: `${intv.start}–${intv.end} ${genitiveMonth}`,
      startDateStr: `${year}-${monthStr}-${startPad}`,
      endDateStr: `${year}-${monthStr}-${endPad}`,
    };
  });
}

/**
 * Extracts and normalizes task numbers from strings like:
 * "№ 5, № 8, № 12", "№5, №8", "5, 8, 12, задание 14"
 * Returns formatted array like ["№5", "№8", "№12", "№14"]
 */
export function extractTaskNumbers(taskStrings: string[]): string[] {
  const numberSet = new Set<number>();
  const customTokensSet = new Set<string>();

  for (const str of taskStrings) {
    if (!str || !str.trim()) continue;
    const tokens = str.split(/[,;\n]+/);
    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed) continue;
      const numMatch = trimmed.match(/\b\d+\b/);
      if (numMatch) {
        numberSet.add(parseInt(numMatch[0], 10));
      } else {
        customTokensSet.add(trimmed);
      }
    }
  }

  const sortedNumbers = Array.from(numberSet)
    .sort((a, b) => a - b)
    .map((n) => `№${n}`);

  return [...sortedNumbers, ...Array.from(customTokensSet)];
}
