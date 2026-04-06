export interface StopRecord {
	seq: number;
	type: 'pickup' | 'delivery';
	location: string;
	date: string;
	weightKg: number;
	gps: object | null;
}

export interface Trip {
	id: string;
	driver_name: string;
	advance_payment: number;
	stops: StopRecord[] | string;
	pickup_locations: string;
	delivery_locations: string;
	total_pickup_kg: number;
	total_delivery_kg: number;
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

export interface DisplayRow {
	tripId: string;
	driverName: string;
	tripNumber: number;
	submittedAt: string;
	isDraft: boolean;
	pickupLocation: string;
	pickupWeightKg: number;
	deliveryLocation: string;
	deliveryWeightKg: number;
	advancePayment: number;
	openingBalance: number;
	fuelNamPhatVnd: number;
	loadingFeeVnd: number;
	additionalCosts: string | AdditionalCost[];
	additionalTotal: number;
	totalCost: number;
	closingBalance: number;
	isFirstRow: boolean;
	rowsInGroup: number;
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
	totalCost: number;
	totalPickupKg: number;
	totalDeliveryKg: number;
}

export interface Filters {
	driver: string;
	status: string;
	days: number;
}

export interface Contract {
	id: string;
	name: string;
	subject: string;
	targetWeightKg: number;
	deliveredWeightKg: number;
	pricePerKg: number;
	startDate: string;
	endDate: string;
	status: string;
	completionPct: number;
	remainingKg: number;
	contractValueVnd: number;
	daysLeft: number;
	alerting: boolean;
	notes: string;
	createdAt: string;
	updatedAt: string;
}

export interface ContractForm {
	name: string;
	subject: string;
	targetWeightKg: number;
	pricePerKg: number;
	startDate: string;
	endDate: string;
	notes: string;
}
