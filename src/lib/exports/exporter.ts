import type { Trip, StopRecord } from '$lib/api/types';
import { vnd, formatDate, formatDateShort } from '$lib/format';
import { saveAs } from 'file-saver';
import XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function parseStops(raw: StopRecord[] | string): StopRecord[] {
	try {
		const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return Array.isArray(arr) ? arr : [];
	} catch { return []; }
}

interface ExpandedRow {
	driver: string;
	tripNumber: number;
	pickupLabel: string;
	deliveryLabel: string;
	date: string;
	dateShort: string;
	pickupKg: number;
	deliveryKg: number;
	advance: number;
	fuel: number;
	loading: number;
	additional: number;
	totalCost: number;
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
				pickupKg: p?.weightKg || 0,
				deliveryKg: d?.weightKg || 0,
				advance: t.advance_payment,
				fuel: t.fuel_nam_phat_vnd,
				loading: t.loading_fee_vnd,
				additional: t.additionalTotal,
				totalCost: t.totalCost,
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

export function exportCSV(trips: Trip[]) {
	const rows = expandToRows(trips);
	const headers = ['Tài xế', 'Chuyến', 'Nơi lấy', 'Nơi giao', 'Ngày gửi', 'KG lấy', 'KG giao', 'Tiền ứng', 'Dầu NP', 'Bốc xếp', 'Phát sinh', 'Tổng CP', 'Trạng thái'];
	const lines = [
		headers.join(','),
		...rows.map(r => [
			`"${r.driver}"`,
			r.tripNumber,
			`"${r.pickupLabel}"`,
			`"${r.deliveryLabel}"`,
			`"${r.isFirstRow ? r.date : ''}"`,
			r.pickupKg || '',
			r.deliveryKg || '',
			r.isFirstRow ? r.advance : '',
			r.isFirstRow ? r.fuel : '',
			r.isFirstRow ? r.loading : '',
			r.isFirstRow ? r.additional : '',
			r.isFirstRow ? r.totalCost : '',
			`"${r.isFirstRow ? r.status : ''}"`,
		].join(',')),
	];
	const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
	saveAs(blob, `chuyen_${timestamp()}.csv`);
}

export function exportExcel(trips: Trip[]) {
	const rows = expandToRows(trips);
	const headers = ['Tài xế', 'Chuyến', 'Nơi lấy', 'Nơi giao', 'Ngày gửi', 'KG lấy', 'KG giao', 'Tiền ứng', 'Dầu NP', 'Bốc xếp', 'Phát sinh', 'Tổng CP', 'Trạng thái'];

	const data: (string | number)[][] = [
		headers,
		...rows.map(r => [
			r.driver,
			r.tripNumber,
			r.pickupLabel,
			r.deliveryLabel,
			r.isFirstRow ? r.date : '',
			r.pickupKg || '',
			r.deliveryKg || '',
			r.isFirstRow ? r.advance : '',
			r.isFirstRow ? r.fuel : '',
			r.isFirstRow ? r.loading : '',
			r.isFirstRow ? r.additional : '',
			r.isFirstRow ? r.totalCost : '',
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
		{ wch: 10 },  // KG lấy
		{ wch: 10 },  // KG giao
		{ wch: 14 },  // Tiền ứng
		{ wch: 14 },  // Dầu NP
		{ wch: 14 },  // Bốc xếp
		{ wch: 14 },  // Phát sinh
		{ wch: 14 },  // Tổng CP
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
	const vndCols = new Set([7, 8, 9, 10, 11]); // Tiền ứng, Dầu NP, Bốc xếp, Phát sinh, Tổng CP
	const kgCols = new Set([5, 6]); // KG lấy, KG giao
	const centerCols = new Set([1, 4, 12]); // Chuyến, Ngày gửi, Trạng thái

	const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
	for (let r = range.s.r; r <= range.e.r; r++) {
		for (let c = range.s.c; c <= range.e.c; c++) {
			const addr = XLSX.utils.encode_cell({ r, c });
			if (!ws[addr]) continue;

			if (r === 0) {
				ws[addr].s = headerStyle;
			} else {
				const row = rows[r - 1];
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

				if (vndCols.has(c) || kgCols.has(c)) {
					cellStyle.numFmt = numFmt;
					cellStyle.alignment.horizontal = 'right';
				}

				if (centerCols.has(c)) {
					cellStyle.alignment.horizontal = 'center';
				}

				if (c === 11 && row?.isFirstRow) {
					cellStyle.font = { bold: true, color: { rgb: '0D5BBF' } };
				}

				if (c === 12 && row?.isFirstRow) {
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

	ws['!rows'] = [{ hpt: 28 }];

	XLSX.utils.book_append_sheet(wb, ws, 'Chuyến');
	const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
	saveAs(new Blob([buf], { type: 'application/octet-stream' }), `chuyen_${timestamp()}.xlsx`);
}

export function exportJSON(trips: Trip[]) {
	const rows = expandToRows(trips);
	const jsonRows = rows.map(r => ({
		'Tài xế': r.driver,
		'Chuyến': r.tripNumber,
		'Nơi lấy': r.pickupLabel,
		'Nơi giao': r.deliveryLabel,
		'Ngày gửi': r.isFirstRow ? r.date : '',
		'KG lấy': r.pickupKg,
		'KG giao': r.deliveryKg,
		'Tiền ứng': r.isFirstRow ? r.advance : '',
		'Dầu NP': r.isFirstRow ? r.fuel : '',
		'Bốc xếp': r.isFirstRow ? r.loading : '',
		'Phát sinh': r.isFirstRow ? r.additional : '',
		'Tổng CP': r.isFirstRow ? r.totalCost : '',
		'Trạng thái': r.isFirstRow ? r.status : '',
	}));
	const blob = new Blob([JSON.stringify(jsonRows, null, 2)], { type: 'application/json' });
	saveAs(blob, `chuyen_${timestamp()}.json`);
}

export function exportPDF(trips: Trip[]) {
	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

	doc.setFontSize(18);
	doc.setTextColor(13, 91, 191);
	doc.text('Bao cao chuyen — Pathfinder', 14, 18);

	doc.setFontSize(9);
	doc.setTextColor(107, 114, 128);
	doc.text(`Xuat luc ${new Date().toLocaleString('vi-VN')}`, 14, 25);

	doc.setDrawColor(18, 115, 255);
	doc.setLineWidth(0.5);
	doc.line(14, 28, 283, 28);

	const headers = ['Tai xe', 'Chuyen', 'Noi lay', 'Noi giao', 'Ngay', 'KG lay', 'KG giao', 'Tien ung', 'Dau NP', 'Boc xep', 'Phat sinh', 'Tong CP', 'TT'];
	const rows = expandToRows(trips);
	const body = rows.map(r => [
		r.driver,
		String(r.tripNumber),
		r.pickupLabel,
		r.deliveryLabel,
		r.isFirstRow ? r.dateShort : '',
		r.pickupKg ? r.pickupKg.toLocaleString() : '',
		r.deliveryKg ? r.deliveryKg.toLocaleString() : '',
		r.isFirstRow ? vnd(r.advance) : '',
		r.isFirstRow ? vnd(r.fuel) : '',
		r.isFirstRow ? vnd(r.loading) : '',
		r.isFirstRow ? vnd(r.additional) : '',
		r.isFirstRow ? vnd(r.totalCost) : '',
		r.isFirstRow ? (r.status === 'Nháp' ? 'Nhap' : 'Xong') : '',
	]);

	autoTable(doc, {
		startY: 32,
		head: [headers],
		body,
		styles: { fontSize: 7, cellPadding: 2 },
		headStyles: { fillColor: [18, 115, 255], textColor: 255 },
		alternateRowStyles: { fillColor: [249, 250, 251] },
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
