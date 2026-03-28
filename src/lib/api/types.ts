export interface Trip {
	id: string;
	driver_name: string;
	advance_payment: number;
	pickup_date: string;
	pickup_location: string;
	pickup_weight_kg: number;
	delivery_date: string;
	delivery_location: string;
	delivery_weight_kg: number;
	fuel_nam_phat_vnd: number;
	fuel_hn_liters: number;
	loading_fee_vnd: number;
	additional_costs: string | AdditionalCost[];
	opening_balance: number;
	total_cost: number;
	closing_balance: number;
	additionalTotal: number;
	totalCost: number;
	notes: string;
	is_draft: boolean;
	submitted_at: string;
}

export interface AdditionalCost {
	name: string;
	amountVnd: number;
	note: string;
}

export interface DashboardSummary {
	totalTrips: number;
	completedTrips: number;
	draftTrips: number;
	totalAdvance: number;
	totalFuel: number;
	totalLoading: number;
	totalPickupKg: number;
	totalDeliveryKg: number;
}

export interface Filters {
	driver: string;
	status: string;
	days: number;
}
