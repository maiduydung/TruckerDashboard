import type { DashboardSummary, Filters, Trip, Contract, ContractForm, ContractStatus, WipeResult } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://nhutin-trucker-api.azurewebsites.net/api';
const FUNCTIONS_KEY = import.meta.env.VITE_FUNCTIONS_KEY ?? '';

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
	if (filters.from) params.set('from', filters.from);
	if (filters.to) params.set('to', filters.to);
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

/**
 * Trigger a soft-delete of trips dated before the start of the current month (ICT).
 * Backend requires the `x-functions-key` header. Throws ApiError on non-2xx.
 *
 * @param triggeredBy free-form log label, defaults to 'dashboard'
 */
export async function wipePreviousMonths(
	triggeredBy: string = 'dashboard'
): Promise<WipeResult> {
	const res = await fetch(`${API_BASE}/wipe`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-functions-key': FUNCTIONS_KEY,
		},
		body: JSON.stringify({ triggered_by: triggeredBy }),
	});
	await throwIfNotOk(res);
	const data = await res.json();
	return {
		wipedCount: data.wiped_count,
		cutoff: data.cutoff,
	};
}
