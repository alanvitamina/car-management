import dayjs from 'dayjs';

/** 统一时间格式: 2026-5-15,9:00 */
export function fmtTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = dayjs(dateStr);
  if (!d.isValid()) return dateStr;
  return d.format('YYYY-M-D,HH:mm');
}
