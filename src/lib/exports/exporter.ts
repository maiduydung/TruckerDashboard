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

function formatStopDetails(stops: StopRecord[], type: 'pickup' | 'delivery'): string {
	const filtered = stops.filter(s => s.type === type);
	return filtered
		.map(s => `${s.location} (${(s.weightKg || 0).toLocaleString()}kg)`)
		.join('\n');
}

function tripRows(trips: Trip[]) {
	return trips.map(t => ({
		'Tài xế': t.driver_name,
		'Nơi lấy': t.pickup_locations,
		'Nơi giao': t.delivery_locations,
		'Ngày gửi': formatDate(t.submitted_at),
		'KG lấy': t.total_pickup_kg,
		'KG giao': t.total_delivery_kg,
		'Tiền ứng': t.advance_payment,
		'Dầu NP': t.fuel_nam_phat_vnd,
		'Phát sinh': t.additionalTotal,
		'Tổng CP': t.totalCost,
		'Trạng thái': t.is_draft ? 'Nháp' : 'Xong',
	}));
}

function timestamp(): string {
	return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function exportCSV(trips: Trip[]) {
	const rows = tripRows(trips);
	const headers = Object.keys(rows[0] || {});
	const lines = [
		headers.join(','),
		...rows.map(r => headers.map(h => `"${r[h as keyof typeof r]}"`).join(',')),
	];
	const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
	saveAs(blob, `chuyen_${timestamp()}.csv`);
}

export function exportExcel(trips: Trip[]) {
	const rows = tripRows(trips);
	const headers = Object.keys(rows[0] || {});
	const wb = XLSX.utils.book_new();

	// Build data array with rich stop details for Nơi lấy / Nơi giao
	const data: (string | number)[][] = [
		headers,
		...trips.map((t, i) => {
			const stops = parseStops(t.stops);
			const base = headers.map(h => rows[i][h as keyof typeof rows[0]]);
			// Override Nơi lấy (col 1) and Nơi giao (col 2) with rich multi-line format
			base[1] = formatStopDetails(stops, 'pickup');
			base[2] = formatStopDetails(stops, 'delivery');
			return base;
		}),
	];

	const ws = XLSX.utils.aoa_to_sheet(data);

	// ── Column widths ──
	ws['!cols'] = [
		{ wch: 10 }, // Tài xế
		{ wch: 22 }, // Nơi lấy (wider for multi-stop with weights)
		{ wch: 22 }, // Nơi giao (wider for multi-stop with weights)
		{ wch: 14 }, // Ngày gửi
		{ wch: 10 }, // KG lấy
		{ wch: 10 }, // KG giao
		{ wch: 14 }, // Tiền ứng
		{ wch: 14 }, // Dầu NP
		{ wch: 14 }, // Phát sinh
		{ wch: 14 }, // Tổng CP
		{ wch: 10 }, // Trạng thái
	];

	// ── Styles ──
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

	const vndCols = new Set([6, 7, 8, 9]); // Tiền ứng, Dầu NP, Phát sinh, Tổng CP
	const kgCols = new Set([4, 5]); // KG lấy, KG giao
	const centerCols = new Set([3, 10]); // Ngày gửi, Trạng thái
	const wrapCols = new Set([1, 2]); // Nơi lấy, Nơi giao (multi-line)

	// Apply styles to all cells
	const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
	for (let r = range.s.r; r <= range.e.r; r++) {
		for (let c = range.s.c; c <= range.e.c; c++) {
			const addr = XLSX.utils.encode_cell({ r, c });
			if (!ws[addr]) continue;

			if (r === 0) {
				// Header row
				ws[addr].s = headerStyle;
			} else {
				// Data rows
				const isEven = r % 2 === 0;
				const cellStyle: any = {
					border: borderThin,
					alignment: { vertical: 'center' as const },
				};

				if (isEven) {
					cellStyle.fill = { fgColor: { rgb: 'F3F4F6' } };
				}

				if (vndCols.has(c) || kgCols.has(c)) {
					cellStyle.numFmt = numFmt;
					cellStyle.alignment.horizontal = 'right';
				}

				if (centerCols.has(c)) {
					cellStyle.alignment.horizontal = 'center';
				}

				if (wrapCols.has(c)) {
					cellStyle.alignment.wrapText = true;
					cellStyle.alignment.vertical = 'top';
				}

				// Highlight Tổng CP column
				if (c === 9) {
					cellStyle.font = { bold: true, color: { rgb: '0D5BBF' } };
				}

				// Status badge colors
				if (c === 10) {
					const val = ws[addr].v;
					if (val === 'Xong') {
						cellStyle.font = { bold: true, color: { rgb: '155724' } };
						cellStyle.fill = { fgColor: { rgb: 'D4EDDA' } };
					} else {
						cellStyle.font = { bold: true, color: { rgb: '856404' } };
						cellStyle.fill = { fgColor: { rgb: 'FFF3CD' } };
					}
				}

				ws[addr].s = cellStyle;
			}
		}
	}

	// Row heights: header + dynamic for multi-stop rows
	ws['!rows'] = [{ hpt: 28 }];
	for (let i = 0; i < trips.length; i++) {
		const stops = parseStops(trips[i].stops);
		const maxLines = Math.max(
			stops.filter(s => s.type === 'pickup').length,
			stops.filter(s => s.type === 'delivery').length,
			1,
		);
		if (maxLines > 1) {
			ws['!rows'][i + 1] = { hpt: maxLines * 18 };
		}
	}

	XLSX.utils.book_append_sheet(wb, ws, 'Chuyến');
	const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
	saveAs(new Blob([buf], { type: 'application/octet-stream' }), `chuyen_${timestamp()}.xlsx`);
}

export function exportJSON(trips: Trip[]) {
	const rows = tripRows(trips);
	const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
	saveAs(blob, `chuyen_${timestamp()}.json`);
}

export function exportPDF(trips: Trip[]) {
	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

	doc.setFontSize(18);
	doc.setTextColor(13, 91, 191);
	doc.text('Bao cao chuyen — NhuTin', 14, 18);

	doc.setFontSize(9);
	doc.setTextColor(107, 114, 128);
	doc.text(`Xuat luc ${new Date().toLocaleString('vi-VN')}`, 14, 25);

	doc.setDrawColor(18, 115, 255);
	doc.setLineWidth(0.5);
	doc.line(14, 28, 283, 28);

	const headers = ['Tai xe', 'Noi lay', 'Noi giao', 'Ngay gui', 'KG lay', 'KG giao', 'Tien ung', 'Dau NP', 'Phat sinh', 'Tong CP', 'TT'];
	const body = trips.map(t => {
		const stops = parseStops(t.stops);
		return [
			t.driver_name,
			formatStopDetails(stops, 'pickup'),
			formatStopDetails(stops, 'delivery'),
			formatDateShort(t.submitted_at),
			t.total_pickup_kg.toLocaleString(),
			t.total_delivery_kg.toLocaleString(),
			vnd(t.advance_payment),
			vnd(t.fuel_nam_phat_vnd),
			vnd(t.additionalTotal),
			vnd(t.totalCost),
			t.is_draft ? 'Nhap' : 'Xong',
		];
	});

	autoTable(doc, {
		startY: 32,
		head: [headers],
		body,
		styles: { fontSize: 7, cellPadding: 2 },
		headStyles: { fillColor: [18, 115, 255], textColor: 255 },
		alternateRowStyles: { fillColor: [249, 250, 251] },
	});

	doc.save(`chuyen_${timestamp()}.pdf`);
}
