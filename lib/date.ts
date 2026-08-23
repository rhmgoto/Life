const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export function toDateKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatLongDate(value: string): string {
  const date = parseDateKey(value);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function weekdayLabel(value: string): string {
  return `${DAY_NAMES[parseDateKey(value).getDay()]}曜日`;
}

export function formatShortDate(value: string): string {
  const date = parseDateKey(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function addDays(value: string, amount: number): string {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

export function monthKey(value: string): string { return value.slice(0, 7); }

export function calendarCells(month: string): Array<string | null> {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const days = new Date(year, monthNumber, 0).getDate();
  const cells: Array<string | null> = Array(first.getDay()).fill(null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(`${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function currentTime(): string {
  return new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
}
