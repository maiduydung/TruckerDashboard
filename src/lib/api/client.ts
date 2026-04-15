import type { DashboardSummary, Filters, Trip, Contract, ContractForm } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://nhutin-trucker-api.azurewebsites.net/api';

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
	if (!res.ok) throw new Error(`API error: ${res.status}`);
	return res.json();
}

export async function fetchTrips(filters: Filters): Promise<Trip[]> {
	const qs = buildParams(filters);
	const res = await fetch(`${API_BASE}/dashboard/trips?${qs}`);
	if (!res.ok) throw new Error(`API error: ${res.status}`);
	const data = await res.json();
	return data.trips;
}

export async function fetchDrivers(): Promise<string[]> {
	const res = await fetch(`${API_BASE}/dashboard/drivers`);
	if (!res.ok) throw new Error(`API error: ${res.status}`);
	const data = await res.json();
	return data.drivers;
}

export async function fetchLocations(): Promise<{ pickups: string[]; deliveries: string[] }> {
	const res = await fetch(`${API_BASE}/dashboard/locations`);
	if (!res.ok) throw new Error(`API error: ${res.status}`);
	return res.json();
}

export async function fetchContracts(): Promise<Contract[]> {
	const res = await fetch(`${API_BASE}/contracts`);
	if (!res.ok) throw new Error(`API error: ${res.status}`);
	const data = await res.json();
	return data.contracts;
}

export async function createContract(form: ContractForm): Promise<{ contractId: string }> {
	const res = await fetch(`${API_BASE}/contracts`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(form),
	});
	if (!res.ok) throw new Error(`API error: ${res.status}`);
	return res.json();
}

export async function updateContract(id: string, form: ContractForm): Promise<void> {
	const res = await fetch(`${API_BASE}/contracts/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(form),
	});
	if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function deleteContract(id: string): Promise<void> {
	const res = await fetch(`${API_BASE}/contracts/${id}`, { method: 'DELETE' });
	if (!res.ok) throw new Error(`API error: ${res.status}`);
}
