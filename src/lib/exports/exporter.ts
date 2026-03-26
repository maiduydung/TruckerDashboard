import type { Trip } from '$lib/api/types';
import { vnd, formatDate } from '$lib/format';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function tripRows(trips: Trip[]) {
	return trips.map(t => ({
		'Tài xế': t.driver_name,
		'Tuyến': `${t.pickup_location} → ${t.delivery_location}`,
		'Ngày gửi': formatDate(t.submitted_at),
		'KG lấy': t.pickup_weight_kg,
		'KG giao': t.delivery_weight_kg,
		'Tiền ứng': t.advance_payment,
		'Dầu NP': t.fuel_nam_phat_vnd,
		'Bốc xếp': t.loading_fee_vnd,
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
	const ws = XLSX.utils.json_to_sheet(rows);
	const wb = XLSX.utils.book_new();
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

	const headers = ['Tai xe', 'Tuyen', 'Ngay', 'KG lay', 'KG giao', 'Tien ung', 'Dau NP', 'Boc xep', 'Phat sinh', 'Tong CP', 'TT'];
	const body = trips.map(t => [
		t.driver_name,
		`${t.pickup_location} → ${t.delivery_location}`,
		formatDate(t.submitted_at),
		t.pickup_weight_kg.toLocaleString(),
		t.delivery_weight_kg.toLocaleString(),
		vnd(t.advance_payment),
		vnd(t.fuel_nam_phat_vnd),
		vnd(t.loading_fee_vnd),
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
