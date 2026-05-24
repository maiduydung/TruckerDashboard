<script lang="ts">
	/**
	 * Trivago-style single-button date range picker.
	 * Trigger button → popover with 2-month calendar + preset chips.
	 * Bindable `from`/`to` strings in YYYY-MM-DD. Empty = unbounded.
	 * Fires `onchange()` after the user commits a range (second click) or a preset.
	 */
	let {
		from = $bindable(''),
		to = $bindable(''),
		onchange,
	}: {
		from?: string;
		to?: string;
		onchange?: () => void;
	} = $props();

	const VN_MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
		'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
	const VN_DOW = ['T2','T3','T4','T5','T6','T7','CN']; // Monday-first

	function toIso(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${dd}`;
	}
	function parseIso(s: string): Date | null {
		if (!s) return null;
		const [y, m, d] = s.split('-').map(Number);
		if (!y || !m || !d) return null;
		return new Date(y, m - 1, d);
	}
	function fmtShort(s: string): string {
		const d = parseIso(s);
		if (!d) return '';
		return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
	}
	/** 0=Mon..6=Sun (offset from JS Sunday-first) */
	function dowMonFirst(d: Date): number {
		return (d.getDay() + 6) % 7;
	}
	function addMonths(d: Date, delta: number): Date {
		return new Date(d.getFullYear(), d.getMonth() + delta, 1);
	}
	function addDays(d: Date, delta: number): Date {
		const n = new Date(d);
		n.setDate(n.getDate() + delta);
		return n;
	}

	let open = $state(false);
	let viewMonth = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
	let tempStart = $state<string | null>(null);
	let hoverDate = $state<string | null>(null);
	let triggerEl: HTMLButtonElement | undefined = $state();
	let popoverEl: HTMLDivElement | undefined = $state();

	const today = new Date();
	const todayIso = toIso(today);

	let buttonLabel = $derived.by(() => {
		if (!from && !to) return 'Tất cả thời gian';
		if (from && to) return `${fmtShort(from)} → ${fmtShort(to)}`;
		return from ? `Từ ${fmtShort(from)}` : `Đến ${fmtShort(to)}`;
	});

	function buildGrid(anchor: Date): Array<{ iso: string; day: number; inMonth: boolean }> {
		const y = anchor.getFullYear();
		const m = anchor.getMonth();
		const first = new Date(y, m, 1);
		const lead = dowMonFirst(first);
		const start = addDays(first, -lead);
		const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
		let cursor = start;
		for (let i = 0; i < 42; i++) {
			cells.push({ iso: toIso(cursor), day: cursor.getDate(), inMonth: cursor.getMonth() === m });
			cursor = addDays(cursor, 1);
		}
		return cells;
	}

	let leftGrid = $derived(buildGrid(viewMonth));
	let rightGrid = $derived(buildGrid(addMonths(viewMonth, 1)));
	let rightAnchor = $derived(addMonths(viewMonth, 1));

	function isInRange(iso: string): boolean {
		const s = tempStart ?? from;
		const e = tempStart ? hoverDate ?? tempStart : to;
		if (!s || !e) return false;
		const lo = s < e ? s : e;
		const hi = s < e ? e : s;
		return iso > lo && iso < hi;
	}
	function isEndpoint(iso: string): boolean {
		if (tempStart) return iso === tempStart;
		return iso === from || iso === to;
	}

	function pickDay(iso: string) {
		if (!tempStart) {
			tempStart = iso;
			hoverDate = iso;
			return;
		}
		const a = tempStart;
		const b = iso;
		from = a < b ? a : b;
		to = a < b ? b : a;
		tempStart = null;
		hoverDate = null;
		open = false;
		onchange?.();
	}

	function applyPreset(days: number | 'mtd' | 'all') {
		if (days === 'all') {
			from = '';
			to = '';
		} else if (days === 'mtd') {
			from = toIso(new Date(today.getFullYear(), today.getMonth(), 1));
			to = todayIso;
		} else {
			from = toIso(addDays(today, -(days - 1)));
			to = todayIso;
		}
		tempStart = null;
		hoverDate = null;
		open = false;
		onchange?.();
	}

	function jumpToToday() {
		viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);
	}

	function toggleOpen() {
		open = !open;
		if (open) {
			tempStart = null;
			hoverDate = null;
			// Anchor the right pane on the current `to` (or today) so the user lands in context
			const anchor = parseIso(to) ?? today;
			viewMonth = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
		}
	}

	function handleDocClick(e: MouseEvent) {
		if (!open) return;
		const t = e.target as Node;
		if (popoverEl?.contains(t) || triggerEl?.contains(t)) return;
		open = false;
	}
	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) open = false;
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		document.addEventListener('mousedown', handleDocClick);
		document.addEventListener('keydown', handleKey);
		return () => {
			document.removeEventListener('mousedown', handleDocClick);
			document.removeEventListener('keydown', handleKey);
		};
	});
</script>

<div class="drp">
	<button
		type="button"
		class="drp-trigger"
		class:active={open}
		bind:this={triggerEl}
		onclick={toggleOpen}
		aria-haspopup="dialog"
		aria-expanded={open}
	>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
			stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<rect x="3" y="4" width="18" height="18" rx="2" />
			<path d="M16 2v4M8 2v4M3 10h18" />
		</svg>
		<span class="drp-label">{buttonLabel}</span>
		<svg class="drp-caret" width="10" height="10" viewBox="0 0 24 24" fill="none"
			stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
			aria-hidden="true">
			<path d="M6 9l6 6 6-6" />
		</svg>
	</button>

	{#if open}
		<div class="drp-popover" role="dialog" aria-label="Chọn khoảng thời gian" bind:this={popoverEl}>
			<div class="drp-presets">
				<button type="button" onclick={() => applyPreset(7)}>7 ngày</button>
				<button type="button" onclick={() => applyPreset(30)}>30 ngày</button>
				<button type="button" onclick={() => applyPreset(90)}>90 ngày</button>
				<button type="button" onclick={() => applyPreset('mtd')}>Tháng này</button>
				<button type="button" onclick={() => applyPreset('all')}>Tất cả</button>
			</div>

			<div class="drp-cals">
				<div class="drp-cal">
					<div class="drp-cal-head">
						<button type="button" class="nav" aria-label="Tháng trước"
							onclick={() => (viewMonth = addMonths(viewMonth, -1))}>‹</button>
						<span class="cal-title">{VN_MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</span>
						<span class="nav-spacer"></span>
					</div>
					<div class="dow-row">
						{#each VN_DOW as d}<span class="dow">{d}</span>{/each}
					</div>
					<div class="day-grid">
						{#each leftGrid as cell (cell.iso)}
							<button
								type="button"
								class="day"
								class:out={!cell.inMonth}
								class:today={cell.iso === todayIso}
								class:in-range={isInRange(cell.iso)}
								class:endpoint={isEndpoint(cell.iso)}
								onclick={() => pickDay(cell.iso)}
								onmouseenter={() => { if (tempStart) hoverDate = cell.iso; }}
							>{cell.day}</button>
						{/each}
					</div>
				</div>

				<div class="drp-cal">
					<div class="drp-cal-head">
						<span class="nav-spacer"></span>
						<span class="cal-title">{VN_MONTHS[rightAnchor.getMonth()]} {rightAnchor.getFullYear()}</span>
						<button type="button" class="nav" aria-label="Tháng sau"
							onclick={() => (viewMonth = addMonths(viewMonth, 1))}>›</button>
					</div>
					<div class="dow-row">
						{#each VN_DOW as d}<span class="dow">{d}</span>{/each}
					</div>
					<div class="day-grid">
						{#each rightGrid as cell (cell.iso)}
							<button
								type="button"
								class="day"
								class:out={!cell.inMonth}
								class:today={cell.iso === todayIso}
								class:in-range={isInRange(cell.iso)}
								class:endpoint={isEndpoint(cell.iso)}
								onclick={() => pickDay(cell.iso)}
								onmouseenter={() => { if (tempStart) hoverDate = cell.iso; }}
							>{cell.day}</button>
						{/each}
					</div>
				</div>
			</div>

			<div class="drp-footer">
				<span class="hint">
					{#if tempStart}
						Chọn ngày kết thúc…
					{:else if from && to}
						{fmtShort(from)} → {fmtShort(to)}
					{:else}
						Bấm ngày bắt đầu
					{/if}
				</span>
				<button type="button" class="ghost" onclick={jumpToToday}>Hôm nay</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.drp { position: relative; display: inline-block; }

	.drp-trigger {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 9px 14px;
		background: var(--white, #fff);
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 10px;
		font: inherit; font-size: 14px; color: #111827;
		cursor: pointer;
		transition: border-color 0.15s, box-shadow 0.15s;
		min-height: 38px;
	}
	.drp-trigger:hover { border-color: var(--blue, #1273FF); }
	.drp-trigger.active,
	.drp-trigger:focus-visible {
		outline: none;
		border-color: var(--blue, #1273FF);
		box-shadow: 0 0 0 3px rgba(18,115,255,0.1);
	}
	.drp-label { font-weight: 500; white-space: nowrap; }
	.drp-caret { opacity: 0.55; }

	.drp-popover {
		position: absolute; top: calc(100% + 6px); left: 0; z-index: 100;
		background: var(--white, #fff);
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 14px;
		box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15,23,42,0.06);
		padding: 14px;
		min-width: 560px;
	}

	.drp-presets {
		display: flex; flex-wrap: wrap; gap: 6px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--border, #e5e7eb);
		margin-bottom: 12px;
	}
	.drp-presets button {
		padding: 6px 12px;
		background: #f3f4f6;
		border: 1px solid transparent;
		border-radius: 999px;
		font: inherit; font-size: 13px; color: #374151;
		cursor: pointer;
		transition: background 0.12s, color 0.12s, border-color 0.12s;
	}
	.drp-presets button:hover {
		background: rgba(18,115,255,0.08);
		color: var(--blue, #1273FF);
		border-color: rgba(18,115,255,0.25);
	}

	.drp-cals { display: flex; gap: 24px; }
	.drp-cal { flex: 1; min-width: 0; }

	.drp-cal-head {
		display: grid; grid-template-columns: 32px 1fr 32px;
		align-items: center; margin-bottom: 8px;
	}
	.cal-title { text-align: center; font-weight: 600; font-size: 14px; color: #111827; }
	.nav {
		width: 28px; height: 28px;
		background: transparent; border: none; border-radius: 8px;
		font-size: 18px; line-height: 1; color: #6b7280;
		cursor: pointer; transition: background 0.12s, color 0.12s;
	}
	.nav:hover { background: #f3f4f6; color: var(--blue, #1273FF); }
	.nav-spacer { width: 28px; }

	.dow-row { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
	.dow {
		text-align: center; font-size: 11px; font-weight: 600;
		color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em;
	}

	.day-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
	.day {
		aspect-ratio: 1 / 1;
		display: flex; align-items: center; justify-content: center;
		background: transparent; border: none; border-radius: 8px;
		font: inherit; font-size: 13px; color: #111827;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}
	.day:hover { background: rgba(18,115,255,0.10); }
	.day.out { color: #d1d5db; }
	.day.today { font-weight: 700; box-shadow: inset 0 0 0 1px rgba(18,115,255,0.35); }
	.day.in-range { background: rgba(18,115,255,0.14); border-radius: 0; color: #1e3a8a; }
	.day.endpoint {
		background: var(--blue, #1273FF) !important;
		color: #fff !important;
		font-weight: 600;
		box-shadow: none;
	}

	.drp-footer {
		display: flex; align-items: center; justify-content: space-between;
		padding-top: 12px; margin-top: 12px;
		border-top: 1px solid var(--border, #e5e7eb);
	}
	.hint { font-size: 13px; color: #6b7280; }
	.ghost {
		padding: 6px 12px; background: transparent;
		border: 1px solid var(--border, #e5e7eb); border-radius: 8px;
		font: inherit; font-size: 13px; color: #374151;
		cursor: pointer; transition: background 0.12s;
	}
	.ghost:hover { background: #f9fafb; }

	@media (max-width: 768px) {
		.drp-popover {
			position: fixed; top: auto; bottom: 0; left: 0; right: 0;
			min-width: 0; width: 100%;
			border-radius: 14px 14px 0 0;
			padding: 16px;
			max-height: 85vh; overflow-y: auto;
		}
		.drp-cals { flex-direction: column; gap: 16px; }
	}
</style>
