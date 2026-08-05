export function vnd(value: number): string {
	return value ? value.toLocaleString('vi-VN') : '0';
}

/**
 * Excel's day zero. Serial 1 is 1900-01-01, but Excel wrongly treats 1900 as a
 * leap year, so counting from 1899-12-30 lines up for every date after 1900-03-01.
 */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

/** Number format Excel applies to the date columns. Pair with `ExportDate.serial`. */
export const EXCEL_DATE_FMT = 'dd/mm/yyyy';

interface DateParts {
	year: number;
	/** 1-12, already un-zero-indexed. */
	month: number;
	day: number;
	hours: number;
	minutes: number;
}

/**
 * The single place a timestamp string is turned into date parts.
 * Every formatter below derives from this — do not call `new Date()` elsewhere.
 * Returns null for empty input or an unparseable timestamp.
 */
function parts(iso: string | null | undefined): DateParts | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return {
		year: d.getFullYear(),
		month: d.getMonth() + 1,
		day: d.getDate(),
		hours: d.getHours(),
		minutes: d.getMinutes(),
	};
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

/** `dd/MM HH:mm` — on-screen only. Never use in an export; Excel mangles it. */
export function formatDateTime(iso: string | null | undefined): string {
	const p = parts(iso);
	return p ? `${pad(p.day)}/${pad(p.month)} ${pad(p.hours)}:${pad(p.minutes)}` : '';
}

/** `dd/MM` — chart axis labels only, where horizontal space is tight. */
export function formatDateShort(iso: string | null | undefined): string {
	const p = parts(iso);
	return p ? `${pad(p.day)}/${pad(p.month)}` : '';
}

export interface ExportDate {
	/** `dd/MM/yyyy` date-only text — for CSV, JSON and PDF, which have no cell types. */
	text: string;
	/** Excel serial day number for a real date cell, or '' when there is no date. */
	serial: number | '';
}

/**
 * The one date formatter every export goes through — CSV, Excel, JSON and PDF.
 *
 * Time is deliberately dropped: exports get pasted around and re-typed in Excel,
 * where a `dd/MM HH:mm` string gets coerced into whatever the machine's locale
 * feels like. `serial` sidesteps the guessing entirely by handing Excel a genuine
 * date value instead of text to parse.
 */
export function exportDate(iso: string | null | undefined): ExportDate {
	const p = parts(iso);
	if (!p) return { text: '', serial: '' };
	// UTC math on local Y/M/D so a DST boundary can never shift the serial by a day.
	const serial = (Date.UTC(p.year, p.month - 1, p.day) - EXCEL_EPOCH_MS) / MS_PER_DAY;
	return { text: `${pad(p.day)}/${pad(p.month)}/${p.year}`, serial };
}
