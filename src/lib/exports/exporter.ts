import type { Trip } from '$lib/api/types';
import { vnd, formatDate, formatDateShort } from '$lib/format';
import { saveAs } from 'file-saver';
import XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function tripRows(trips: Trip[]) {
	return trips.map(t => ({
		'Tài xế': t.driver_name,
		'Nơi lấy': t.pickup_location,
		'Nơi giao': t.delivery_location,
		'Ngày lấy': formatDateShort(t.pickup_date),
		'Ngày giao': formatDateShort(t.delivery_date),
		'Ngày gửi': formatDate(t.submitted_at),
		'KG lấy': t.pickup_weight_kg,
		'KG giao': t.delivery_weight_kg,
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

	// Build data array: header + rows
	const data: (string | number)[][] = [
		headers,
		...rows.map(r => headers.map(h => r[h as keyof typeof r])),
	];

	const ws = XLSX.utils.aoa_to_sheet(data);

	// ── Column widths ──
	ws['!cols'] = [
		{ wch: 10 }, // Tài xế
		{ wch: 8 },  // Nơi lấy
		{ wch: 8 },  // Nơi giao
		{ wch: 10 }, // Ngày lấy
		{ wch: 10 }, // Ngày giao
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

	const vndCols = new Set([8, 9, 10, 11]); // Tiền ứng, Dầu NP, Phát sinh, Tổng CP
	const kgCols = new Set([6, 7]); // KG lấy, KG giao
	const centerCols = new Set([1, 2, 3, 4, 12]); // Nơi lấy, Nơi giao, Ngày lấy, Ngày giao, Trạng thái

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

				// Highlight Tổng CP column
				if (c === 11) {
					cellStyle.font = { bold: true, color: { rgb: '0D5BBF' } };
				}

				// Status badge colors
				if (c === 12) {
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

	// Row height for header
	ws['!rows'] = [{ hpt: 28 }];

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

	const headers = ['Tai xe', 'Noi lay', 'Noi giao', 'Ngay lay', 'Ngay giao', 'KG lay', 'KG giao', 'Tien ung', 'Dau NP', 'Phat sinh', 'Tong CP', 'TT'];
	const body = trips.map(t => [
		t.driver_name,
		t.pickup_location,
		t.delivery_location,
		formatDateShort(t.pickup_date),
		formatDateShort(t.delivery_date),
		t.pickup_weight_kg.toLocaleString(),
		t.delivery_weight_kg.toLocaleString(),
		vnd(t.advance_payment),
		vnd(t.fuel_nam_phat_vnd),
		vnd(t.additionalTotal),
		vnd(t.totalCost),
		t.is_draft ? 'Nhap' : 'Xong',
	]);

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
