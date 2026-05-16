import type { DashboardSummary, Filters, Trip, Contract, ContractForm, ContractStatus } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://nhutin-trucker-api.azurewebsites.net/api';

/**
 * Error thrown by API client functions when the backend returns a non-2xx response.
 * Carries the user-facing Vietnamese message (`message`), an optional `summary`
 * listing every missing field, and `fieldErrors` keyed by camelCase field name
 * for inline form highlighting.
 */
export class ApiError extends Error {
	status: number;
	fieldErrors: Record<string, string>;
	summary?: string;
	constructor(status: number, message: string, fieldErrors: Record<string, string> = {}, summary?: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.fieldErrors = fieldErrors;
		this.summary = summary;
	}
}

async function throwIfNotOk(res: Response): Promise<void> {
	if (res.ok) return;
	let body: { error?: string; summary?: string; fieldErrors?: Record<string, string> } = {};
	try {
		body = await res.json();
	} catch {
		// non-JSON error body — fall through with the empty object
	}
	const msg = body.error || body.summary || `Lỗi máy chủ (${res.status})`;
	throw new ApiError(res.status, msg, body.fieldErrors || {}, body.summary);
}

function buildParams(filters: Filters): string {
	const params = new URLSearchParams();
	if (filters.driver) params.set('driver', filters.driver);
	if (filters.status) params.set('status', filters.status);
	if (filters.days > 0) params.set('days', String(filters.days));
	return params.toString();
}

export async function fetchSummary(filters: Filters): Promise<DashboardSummary> {
	const qs = buildParams(filters);
	const res = await fetch(`${API_BASE}/dashboard/summary?${qs}`);
	await throwIfNotOk(res);
	return res.json();
}

export async function fetchTrips(filters: Filters): Promise<Trip[]> {
	const qs = buildParams(filters);
	const res = await fetch(`${API_BASE}/dashboard/trips?${qs}`);
	await throwIfNotOk(res);
	const data = await res.json();
	return data.trips;
}

export async function fetchDrivers(): Promise<string[]> {
	const res = await fetch(`${API_BASE}/dashboard/drivers`);
	await throwIfNotOk(res);
	const data = await res.json();
	return data.drivers;
}

export async function fetchLocations(): Promise<{ pickups: string[]; deliveries: string[] }> {
	const res = await fetch(`${API_BASE}/dashboard/locations`);
	await throwIfNotOk(res);
	return res.json();
}

export async function fetchContracts(): Promise<Contract[]> {
	const res = await fetch(`${API_BASE}/contracts`);
	await throwIfNotOk(res);
	const data = await res.json();
	return data.contracts;
}

export async function createContract(form: ContractForm): Promise<{ contractId: string }> {
	const res = await fetch(`${API_BASE}/contracts`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(form),
	});
	await throwIfNotOk(res);
	return res.json();
}

export async function updateContract(
	id: string,
	form: ContractForm & { status?: ContractStatus },
): Promise<void> {
	const res = await fetch(`${API_BASE}/contracts/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(form),
	});
	await throwIfNotOk(res);
}

export async function deleteContract(id: string): Promise<void> {
	const res = await fetch(`${API_BASE}/contracts/${id}`, { method: 'DELETE' });
	await throwIfNotOk(res);
}
