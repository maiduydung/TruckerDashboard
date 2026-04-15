import type { Trip, StopRecord, AdditionalCost } from '$lib/api/types';
import { vnd, formatDate, formatDateShort } from '$lib/format';
import { saveAs } from 'file-saver';
import XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import robotoRegularUrl from '$lib/assets/fonts/Roboto-Regular.ttf?url';
import robotoBoldUrl from '$lib/assets/fonts/Roboto-Bold.ttf?url';

let _fontCache: { regular: string; bold: string } | null = null;
async function loadPdfFonts(): Promise<{ regular: string; bold: string }> {
	if (_fontCache) return _fontCache;
	const toBase64 = async (url: string) => {
		const res = await fetch(url);
		const buf = await res.arrayBuffer();
		const bytes = new Uint8Array(buf);
		let bin = '';
		const CHUNK = 0x8000;
		for (let i = 0; i < bytes.length; i += CHUNK) {
			bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
		}
		return btoa(bin);
	};
	const [regular, bold] = await Promise.all([toBase64(robotoRegularUrl), toBase64(robotoBoldUrl)]);
	_fontCache = { regular, bold };
	return _fontCache;
}

function parseStops(raw: StopRecord[] | string): StopRecord[] {
	try {
		const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return Array.isArray(arr) ? arr : [];
	} catch { return []; }
}

function parseAdditional(raw: string | AdditionalCost[] | undefined): AdditionalCost[] {
	try {
		const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return Array.isArray(items) ? items.filter(c => c.name && c.amountVnd > 0) : [];
	} catch { return []; }
}

function formatAdditionalCosts(raw: string | AdditionalCost[] | undefined): string {
	return parseAdditional(raw).map(c => `${c.name}: ${c.amountVnd.toLocaleString('vi-VN')}đ`).join('; ');
}

export const ADDITIONAL_CATEGORIES: { key: string; label: string; aliases: string[] }[] = [
	{ key: 'xeXuc', label: 'Xe xúc', aliases: ['xe xúc', 'xe xuc'] },
	{ key: 'loHoi', label: 'Lò hơi', aliases: ['lò hơi', 'lo hoi'] },
	{ key: 'canXe', label: 'Cân xe', aliases: ['cân xe', 'can xe'] },
	{ key: 'com', label: 'Cơm', aliases: ['cơm', 'com'] },
	{ key: 'boiDuongCan', label: 'Bồi dưỡng cân', aliases: ['bồi dưỡng cân', 'boi duong can'] },
	{ key: 'baoVe', label: 'Bảo vệ', aliases: ['bảo vệ', 'bao ve'] },
	{ key: 'vaVo', label: 'Va vỡ', aliases: ['va vỡ', 'va vo'] },
	{ key: 'ruaXe', label: 'Rửa xe', aliases: ['rửa xe', 'rua xe'] },
	{ key: 'khac', label: 'Khác', aliases: ['khác', 'khac'] },
];

function normalize(s: string): string {
	return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function categorizeAdditional(raw: string | AdditionalCost[] | undefined): Record<string, number> {
	const out: Record<string, number> = {};
	for (const cat of ADDITIONAL_CATEGORIES) out[cat.key] = 0;
	for (const c of parseAdditional(raw)) {
		const n = normalize(c.name);
		const match = ADDITIONAL_CATEGORIES.find(cat => cat.aliases.some(a => normalize(a) === n));
		if (match) out[match.key] += c.amountVnd;
		else out.khac += c.amountVnd;
	}
	return out;
}

interface ExpandedRow {
	driver: string;
	tripNumber: number;
	pickupLabel: string;
	deliveryLabel: string;
	date: string;
	dateShort: string;
	receivedDate: string;
	receivedDateShort: string;
	pickupKg: number;
	deliveryKg: number;
	advance: number;
	openingBalance: number;
	fuel: number;
	fuelHnLiters: number;
	loading: number;
	additional: number;
	totalCost: number;
	closingBalance: number;
	notes: string;
	additionalBreakdown: string;
	additionalByCategory: Record<string, number>;
	status: string;
	isFirstRow: boolean;
}

function computeTripNumbers(trips: Trip[]): Map<string, number> {
	const map = new Map<string, number>();
	const groups = new Map<string, Trip[]>();
	for (const t of trips) {
		if (!groups.has(t.driver_name)) groups.set(t.driver_name, []);
		groups.get(t.driver_name)!.push(t);
	}
	for (const [, dTrips] of groups) {
		const sorted = [...dTrips].sort(
			(a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
		);
		sorted.forEach((t, i) => map.set(t.id, i + 1));
	}
	return map;
}

function expandToRows(trips: Trip[]): ExpandedRow[] {
	const tripNumbers = computeTripNumbers(trips);
	const rows: ExpandedRow[] = [];

	for (const t of trips) {
		const stops = parseStops(t.stops);
		const pickups = stops.filter(s => s.type === 'pickup');
		const deliveries = stops.filter(s => s.type === 'delivery');
		const count = Math.max(pickups.length, deliveries.length, 1);
		const tripNum = tripNumbers.get(t.id) || 1;

		for (let i = 0; i < count; i++) {
			const p = pickups[i];
			const d = deliveries[i];
			rows.push({
				driver: t.driver_name,
				tripNumber: tripNum,
				pickupLabel: p?.location || '',
				deliveryLabel: d?.location || '',
				date: formatDate(t.submitted_at),
				dateShort: formatDateShort(t.submitted_at),
				receivedDate: t.received_at ? formatDate(t.received_at) : '',
				receivedDateShort: t.received_at ? formatDateShort(t.received_at) : '',
				pickupKg: p?.weightKg || 0,
				deliveryKg: d?.weightKg || 0,
				advance: t.advance_payment,
				openingBalance: t.opening_balance,
				fuel: t.fuel_nam_phat_vnd,
				fuelHnLiters: t.fuel_hn_liters || 0,
				loading: t.loading_fee_vnd,
				additional: t.additionalTotal,
				totalCost: t.totalCost,
				closingBalance: t.closing_balance,
				notes: t.notes || '',
				additionalBreakdown: formatAdditionalCosts(t.additional_costs),
				additionalByCategory: categorizeAdditional(t.additional_costs),
				status: t.is_draft ? 'Nháp' : 'Xong',
				isFirstRow: i === 0,
			});
		}
	}
	return rows;
}

function timestamp(): string {
	return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function csvEscape(v: string | number): string {
	const s = String(v ?? '');
	return `"${s.replace(/"/g, '""')}"`;
}

export function exportCSV(trips: Trip[], rangeLabel: string = '') {
	const rows = expandToRows(trips);
	const catLabels = ADDITIONAL_CATEGORIES.map(c => c.label);
	const headers = ['Tài xế', 'Chuyến', 'Nơi lấy', 'Nơi giao', 'Ngày gửi', 'Ngày nhận', 'KG lấy', 'KG giao', 'Tiền ứng', 'Dư đầu', 'Dầu NP', 'Dầu HN (L)', 'Bốc xếp', ...catLabels, 'Phát sinh', 'Tổng CP', 'Dư cuối', 'Ghi chú', 'Trạng thái'];
	const lines = [
		...(rangeLabel ? [csvEscape(`Khoảng thời gian: ${rangeLabel}`), ''] : []),
		headers.join(','),
		...rows.map(r => [
			csvEscape(r.driver),
			r.tripNumber,
			csvEscape(r.pickupLabel),
			csvEscape(r.deliveryLabel),
			csvEscape(r.isFirstRow ? r.date : ''),
			csvEscape(r.isFirstRow ? r.receivedDate : ''),
			r.pickupKg || '',
			r.deliveryKg || '',
			r.isFirstRow ? r.advance : '',
			r.isFirstRow ? r.openingBalance : '',
			r.isFirstRow ? r.fuel : '',
			r.isFirstRow ? (r.fuelHnLiters || '') : '',
			r.isFirstRow ? r.loading : '',
			...ADDITIONAL_CATEGORIES.map(c => r.isFirstRow ? (r.additionalByCategory[c.key] || '') : ''),
			r.isFirstRow ? r.additional : '',
			r.isFirstRow ? r.totalCost : '',
			r.isFirstRow ? r.closingBalance : '',
			csvEscape(r.isFirstRow ? r.notes : ''),
			csvEscape(r.isFirstRow ? r.status : ''),
		].join(',')),
	];
	const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
	saveAs(blob, `chuyen_${timestamp()}.csv`);
}

export function exportExcel(trips: Trip[], rangeLabel: string = '') {
	const rows = expandToRows(trips);
	const catLabels = ADDITIONAL_CATEGORIES.map(c => c.label);
	const headers = ['Tài xế', 'Chuyến', 'Nơi lấy', 'Nơi giao', 'Ngày gửi', 'Ngày nhận', 'KG lấy', 'KG giao', 'Tiền ứng', 'Dư đầu', 'Dầu NP', 'Dầu HN (L)', 'Bốc xếp', ...catLabels, 'Phát sinh', 'Tổng CP', 'Dư cuối', 'Ghi chú', 'Trạng thái'];

	const titleRows: (string | number)[][] = rangeLabel
		? [[`Khoảng thời gian: ${rangeLabel}`], []]
		: [];
	const headerRowIdx = titleRows.length;
	const data: (string | number)[][] = [
		...titleRows,
		headers,
		...rows.map(r => [
			r.driver,
			r.tripNumber,
			r.pickupLabel,
			r.deliveryLabel,
			r.isFirstRow ? r.date : '',
			r.isFirstRow ? r.receivedDate : '',
			r.pickupKg || '',
			r.deliveryKg || '',
			r.isFirstRow ? r.advance : '',
			r.isFirstRow ? r.openingBalance : '',
			r.isFirstRow ? r.fuel : '',
			r.isFirstRow ? (r.fuelHnLiters || '') : '',
			r.isFirstRow ? r.loading : '',
			...ADDITIONAL_CATEGORIES.map(c => r.isFirstRow ? (r.additionalByCategory[c.key] || '') : ''),
			r.isFirstRow ? r.additional : '',
			r.isFirstRow ? r.totalCost : '',
			r.isFirstRow ? r.closingBalance : '',
			r.isFirstRow ? r.notes : '',
			r.isFirstRow ? r.status : '',
		]),
	];

	const wb = XLSX.utils.book_new();
	const ws = XLSX.utils.aoa_to_sheet(data);

	ws['!cols'] = [
		{ wch: 10 },  // Tài xế
		{ wch: 7 },   // Chuyến
		{ wch: 20 },  // Nơi lấy
		{ wch: 20 },  // Nơi giao
		{ wch: 14 },  // Ngày gửi
		{ wch: 14 },  // Ngày nhận
		{ wch: 10 },  // KG lấy
		{ wch: 10 },  // KG giao
		{ wch: 14 },  // Tiền ứng
		{ wch: 14 },  // Dư đầu
		{ wch: 14 },  // Dầu NP
		{ wch: 12 },  // Dầu HN (L)
		{ wch: 14 },  // Bốc xếp
		...ADDITIONAL_CATEGORIES.map(() => ({ wch: 12 })),
		{ wch: 14 },  // Phát sinh
		{ wch: 14 },  // Tổng CP
		{ wch: 14 },  // Dư cuối
		{ wch: 26 },  // Ghi chú
		{ wch: 10 },  // Trạng thái
	];

	const headerStyle = {
		font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
		fill: { fgColor: { rgb: '0D5BBF' } },
		alignment: { horizontal: 'center' as const, vertical: 'center' as const },
		border: {
			top: { style: 'thin' as const, color: { rgb: '0D5BBF' } },
			bottom: { style: 'thin' as const, color: { rgb: '0D5BBF' } },
			left: { style: 'thin' as const, color: { rgb: '0D5BBF' } },
			right: { style: 'thin' as const, color: { rgb: '0D5BBF' } },
		},
	};

	const borderThin = {
		top: { style: 'thin' as const, color: { rgb: 'D1D5DB' } },
		bottom: { style: 'thin' as const, color: { rgb: 'D1D5DB' } },
		left: { style: 'thin' as const, color: { rgb: 'D1D5DB' } },
		right: { style: 'thin' as const, color: { rgb: 'D1D5DB' } },
	};

	const numFmt = '#,##0';
	const catStart = 13;
	const catEnd = catStart + ADDITIONAL_CATEGORIES.length - 1;
	const phatSinhCol = catEnd + 1;
	const totalCol = phatSinhCol + 1;
	const duCuoiCol = totalCol + 1;
	const ghiChuCol = duCuoiCol + 1;
	const statusCol = ghiChuCol + 1;
	const vndCols = new Set<number>([8, 9, 10, 12, phatSinhCol, totalCol, duCuoiCol]);
	for (let i = catStart; i <= catEnd; i++) vndCols.add(i);
	const kgCols = new Set([6, 7]);
	const litersCols = new Set([11]);
	const centerCols = new Set([1, 4, 5, statusCol]);

	const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
	for (let r = range.s.r; r <= range.e.r; r++) {
		for (let c = range.s.c; c <= range.e.c; c++) {
			const addr = XLSX.utils.encode_cell({ r, c });
			if (!ws[addr]) continue;

			if (r < headerRowIdx) {
				if (r === 0 && c === 0) {
					ws[addr].s = {
						font: { bold: true, sz: 11, color: { rgb: '334155' } },
						alignment: { vertical: 'center' as const },
					};
				}
				continue;
			}

			if (r === headerRowIdx) {
				ws[addr].s = headerStyle;
			} else {
				const row = rows[r - headerRowIdx - 1];
				const isGroupCont = row && !row.isFirstRow;
				const cellStyle: any = {
					border: borderThin,
					alignment: { vertical: 'center' as const },
				};

				if (isGroupCont) {
					cellStyle.fill = { fgColor: { rgb: 'F9FAFB' } };
					cellStyle.font = { color: { rgb: '9CA3AF' }, sz: 10 };
				} else if (r % 2 === 0) {
					cellStyle.fill = { fgColor: { rgb: 'F3F4F6' } };
				}

				if (vndCols.has(c) || kgCols.has(c) || litersCols.has(c)) {
					cellStyle.numFmt = numFmt;
					cellStyle.alignment.horizontal = 'right';
				}

				if (centerCols.has(c)) {
					cellStyle.alignment.horizontal = 'center';
				}

				if (c === totalCol && row?.isFirstRow) {
					cellStyle.font = { bold: true, color: { rgb: '0D5BBF' } };
				}

				if (c === statusCol && row?.isFirstRow) {
					const val = ws[addr].v;
					if (val === 'Xong') {
						cellStyle.font = { bold: true, color: { rgb: '155724' } };
						cellStyle.fill = { fgColor: { rgb: 'D4EDDA' } };
					} else if (val === 'Nháp') {
						cellStyle.font = { bold: true, color: { rgb: '856404' } };
						cellStyle.fill = { fgColor: { rgb: 'FFF3CD' } };
					}
				}

				ws[addr].s = cellStyle;
			}
		}
	}

	if (headerRowIdx > 0) {
		const lastCol = headers.length - 1;
		ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];
	}

	ws['!rows'] = [{ hpt: 28 }];

	XLSX.utils.book_append_sheet(wb, ws, 'Chuyến');
	const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
	saveAs(new Blob([buf], { type: 'application/octet-stream' }), `chuyen_${timestamp()}.xlsx`);
}

export function exportJSON(trips: Trip[], rangeLabel: string = '') {
	const rows = expandToRows(trips);
	const jsonRows = rows.map(r => {
		const base: Record<string, string | number> = {
			'Tài xế': r.driver,
			'Chuyến': r.tripNumber,
			'Nơi lấy': r.pickupLabel,
			'Nơi giao': r.deliveryLabel,
			'Ngày gửi': r.isFirstRow ? r.date : '',
			'Ngày nhận': r.isFirstRow ? r.receivedDate : '',
			'KG lấy': r.pickupKg,
			'KG giao': r.deliveryKg,
			'Tiền ứng': r.isFirstRow ? r.advance : '',
			'Dư đầu': r.isFirstRow ? r.openingBalance : '',
			'Dầu NP': r.isFirstRow ? r.fuel : '',
			'Dầu HN (L)': r.isFirstRow ? r.fuelHnLiters : '',
			'Bốc xếp': r.isFirstRow ? r.loading : '',
		};
		for (const c of ADDITIONAL_CATEGORIES) {
			base[c.label] = r.isFirstRow ? (r.additionalByCategory[c.key] || 0) : '';
		}
		base['Phát sinh'] = r.isFirstRow ? r.additional : '';
		base['Tổng CP'] = r.isFirstRow ? r.totalCost : '';
		base['Dư cuối'] = r.isFirstRow ? r.closingBalance : '';
		base['Ghi chú'] = r.isFirstRow ? r.notes : '';
		base['Trạng thái'] = r.isFirstRow ? r.status : '';
		return base;
	});
	const payload = rangeLabel
		? { 'Khoảng thời gian': rangeLabel, 'Chuyến': jsonRows }
		: jsonRows;
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
	saveAs(blob, `chuyen_${timestamp()}.json`);
}

export async function exportPDF(trips: Trip[], rangeLabel: string = '') {
	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

	const { regular, bold } = await loadPdfFonts();
	doc.addFileToVFS('Roboto-Regular.ttf', regular);
	doc.addFileToVFS('Roboto-Bold.ttf', bold);
	doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
	doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
	doc.setFont('Roboto', 'normal');

	doc.setFont('Roboto', 'bold');
	doc.setFontSize(18);
	doc.setTextColor(13, 91, 191);
	doc.text('Báo cáo chuyến — Pathfinder', 14, 18);

	doc.setFont('Roboto', 'normal');
	doc.setFontSize(9);
	doc.setTextColor(107, 114, 128);
	doc.text(`Xuất lúc ${new Date().toLocaleString('vi-VN')}`, 14, 25);
	if (rangeLabel) {
		doc.text(`Khoảng thời gian: ${rangeLabel}`, 120, 25);
	}

	doc.setDrawColor(18, 115, 255);
	doc.setLineWidth(0.5);
	doc.line(14, 28, 283, 28);

	const headers = ['Tài xế', 'Chuyến', 'Nơi lấy', 'Nơi giao', 'Ngày gửi', 'Ngày nhận', 'KG lấy', 'KG giao', 'Tiền ứng', 'Dư đầu', 'Dầu NP', 'Dầu HN (L)', 'Bốc xếp', 'Phát sinh', 'Tổng CP', 'Dư cuối', 'TT'];
	const rows = expandToRows(trips);
	const body = rows.map(r => [
		r.driver,
		String(r.tripNumber),
		r.pickupLabel,
		r.deliveryLabel,
		r.isFirstRow ? r.dateShort : '',
		r.isFirstRow ? r.receivedDateShort : '',
		r.pickupKg ? r.pickupKg.toLocaleString() : '',
		r.deliveryKg ? r.deliveryKg.toLocaleString() : '',
		r.isFirstRow ? vnd(r.advance) : '',
		r.isFirstRow ? vnd(r.openingBalance) : '',
		r.isFirstRow ? vnd(r.fuel) : '',
		r.isFirstRow && r.fuelHnLiters ? r.fuelHnLiters.toLocaleString() : '',
		r.isFirstRow ? vnd(r.loading) : '',
		r.isFirstRow ? vnd(r.additional) : '',
		r.isFirstRow ? vnd(r.totalCost) : '',
		r.isFirstRow ? vnd(r.closingBalance) : '',
		r.isFirstRow ? r.status : '',
	]);

	autoTable(doc, {
		startY: 32,
		head: [headers],
		body,
		styles: { fontSize: 7, cellPadding: 1.5, font: 'Roboto', fontStyle: 'normal', overflow: 'linebreak' },
		headStyles: { fillColor: [18, 115, 255], textColor: 255, font: 'Roboto', fontStyle: 'bold' },
		alternateRowStyles: { fillColor: [249, 250, 251] },
		columnStyles: {
			1: { halign: 'center' },
			4: { halign: 'center' },
			5: { halign: 'center' },
			6: { halign: 'right' },
			7: { halign: 'right' },
			8: { halign: 'right' },
			9: { halign: 'right' },
			10: { halign: 'right' },
			11: { halign: 'right' },
			12: { halign: 'right' },
			13: { halign: 'right' },
			14: { halign: 'right', fontStyle: 'bold' },
			15: { halign: 'right' },
			16: { halign: 'center' },
		},
		didParseCell(data) {
			if (data.section === 'body') {
				const row = rows[data.row.index];
				if (row && !row.isFirstRow) {
					data.cell.styles.textColor = [156, 163, 175];
					data.cell.styles.fontSize = 6;
				}
			}
		},
	});

	doc.save(`chuyen_${timestamp()}.pdf`);
}
