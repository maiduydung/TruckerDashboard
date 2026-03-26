export function vnd(value: number): string {
	return value ? value.toLocaleString('vi-VN') : '0';
}

export function formatDate(iso: string): string {
	if (!iso) return '';
	const d = new Date(iso);
	const dd = String(d.getDate()).padStart(2, '0');
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const hh = String(d.getHours()).padStart(2, '0');
	const min = String(d.getMinutes()).padStart(2, '0');
	return `${dd}/${mm} ${hh}:${min}`;
}

export function formatDateShort(iso: string): string {
	if (!iso) return '';
	const d = new Date(iso);
	const dd = String(d.getDate()).padStart(2, '0');
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	return `${dd}/${mm}`;
}
