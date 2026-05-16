<script lang="ts">
	import { fetchContracts, createContract, updateContract, deleteContract, ApiError } from '$lib/api/client';
	import type { Contract, ContractForm } from '$lib/api/types';
	import { vnd } from '$lib/format';

	let contracts: Contract[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let showForm = $state(false);
	let editingId: string | null = $state(null);
	let saving = $state(false);
	let fieldErrors: Record<string, string> = $state({});

	let form: ContractForm = $state({
		name: '', subject: '', targetWeightKg: 0, pricePerKg: 0,
		startDate: '', endDate: '', notes: '',
	});

	function resetForm() {
		form = { name: '', subject: '', targetWeightKg: 0, pricePerKg: 0, startDate: '', endDate: '', notes: '' };
		editingId = null;
		showForm = false;
		fieldErrors = {};
		error = '';
	}

	function validateClient(): Record<string, string> {
		const errs: Record<string, string> = {};
		if (!form.name.trim()) errs.name = 'Vui lòng nhập tên hợp đồng';
		if (!form.subject.trim()) errs.subject = 'Vui lòng nhập đối tượng hợp đồng';
		if (!form.targetWeightKg || form.targetWeightKg <= 0) errs.targetWeightKg = 'Khối lượng cần giao phải lớn hơn 0';
		if (!form.startDate) errs.startDate = 'Vui lòng chọn ngày bắt đầu';
		if (!form.endDate) errs.endDate = 'Vui lòng chọn ngày kết thúc';
		if (form.startDate && form.endDate && form.endDate < form.startDate) {
			errs.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
		}
		return errs;
	}

	let formInvalid = $derived(Object.keys(validateClient()).length > 0);

	async function loadContracts() {
		loading = true;
		error = '';
		try {
			contracts = await fetchContracts();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Không thể tải dữ liệu';
		} finally {
			loading = false;
		}
	}

	async function handleSave() {
		const clientErrs = validateClient();
		if (Object.keys(clientErrs).length > 0) {
			fieldErrors = clientErrs;
			error = 'Vui lòng kiểm tra các trường còn thiếu';
			return;
		}
		saving = true;
		fieldErrors = {};
		error = '';
		try {
			if (editingId) {
				await updateContract(editingId, form);
			} else {
				await createContract(form);
			}
			resetForm();
			await loadContracts();
		} catch (e) {
			if (e instanceof ApiError) {
				fieldErrors = e.fieldErrors;
				error = e.summary || e.message;
			} else {
				error = e instanceof Error ? e.message : 'Lỗi khi lưu hợp đồng';
			}
		} finally {
			saving = false;
		}
	}

	function startEdit(c: Contract) {
		form = {
			name: c.name, subject: c.subject, targetWeightKg: c.targetWeightKg,
			pricePerKg: c.pricePerKg, startDate: c.startDate, endDate: c.endDate, notes: c.notes,
		};
		editingId = c.id;
		showForm = true;
	}

	async function handleDelete(id: string, name: string) {
		if (!confirm(`Xoá hợp đồng "${name}"?`)) return;
		try {
			await deleteContract(id);
			await loadContracts();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Lỗi khi xoá hợp đồng';
		}
	}

	function contractAsForm(c: Contract): ContractForm {
		// Pluck the fields _validate_payload requires; status is appended separately.
		return {
			name: c.name,
			subject: c.subject,
			targetWeightKg: c.targetWeightKg,
			pricePerKg: c.pricePerKg,
			startDate: c.startDate,
			endDate: c.endDate,
			notes: c.notes,
		};
	}

	async function handleMarkComplete(c: Contract) {
		if (!confirm(`Đánh dấu hợp đồng "${c.name}" là đã hoàn thành?`)) return;
		try {
			await updateContract(c.id, { ...contractAsForm(c), status: 'completed' });
			await loadContracts();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Lỗi khi đánh dấu hoàn thành';
		}
	}

	async function handleReopen(c: Contract) {
		if (!confirm(`Mở lại hợp đồng "${c.name}"? Hệ thống sẽ tự kiểm tra lại trạng thái ở lần đồng bộ tới.`)) return;
		try {
			await updateContract(c.id, { ...contractAsForm(c), status: 'active' });
			await loadContracts();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Lỗi khi mở lại hợp đồng';
		}
	}

	function statusColor(c: Contract): string {
		// Status-driven (drives ct-card border + ct-fill-* + ct-pct-* CSS classes).
		// Once the cron flips a contract out of 'active', color becomes terminal
		// — no more "red at 99.9%, green at 100.2%" inversion.
		if (c.status === 'completed') return 'done';
		if (c.status === 'closed_short') return 'overdue';
		if (c.status === 'active' && c.completionPct >= 100) return 'done'; // green hint: ready to force-close
		if (c.status === 'active' && c.completionPct >= 90) return 'warning';
		return 'active';
	}

	function badgeLabel(c: Contract): string {
		if (c.status === 'completed') return 'Đã hoàn thành';
		if (c.status === 'closed_short') return 'Hết hạn — chưa giao đủ';
		if (c.status === 'active' && c.completionPct >= 90) return 'Sắp hoàn thành';
		return 'Đang giao';
	}

	function formatContractDate(dateStr: string): string {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
	}

	$effect(() => { loadContracts(); });

	let alertingContracts = $derived(contracts.filter(c => c.alerting));
</script>

{#if error}
	<div class="ct-error">{error}</div>
{/if}

{#if alertingContracts.length > 0}
	<div class="ct-alert-banner">
		<div class="ct-alert-icon">!</div>
		<div class="ct-alert-content">
			<strong>Hợp đồng sắp hoàn thành</strong>
			<span class="ct-alert-detail">
				{#each alertingContracts as c, i}
					{#if i > 0}<span class="ct-alert-sep">·</span>{/if}
					<span class="ct-alert-name">{c.name}</span> <span class="ct-alert-pct">{c.completionPct}%</span>
				{/each}
			</span>
		</div>
	</div>
{/if}

<div class="ct-header">
	<h2>Hợp đồng giao hàng</h2>
	<button class="ct-btn ct-btn-primary" onclick={() => { resetForm(); showForm = true; }}>
		+ Thêm hợp đồng
	</button>
</div>

{#if showForm}
	<div class="ct-form-card">
		<h3>{editingId ? 'Cập nhật hợp đồng' : 'Tạo hợp đồng mới'}</h3>
		<div class="ct-form-grid">
			<div class="ct-field">
				<label for="ct-name">Tên hợp đồng</label>
				<input id="ct-name" type="text" bind:value={form.name} placeholder="VD: HĐ tháng 4 TBS" class:ct-invalid={fieldErrors.name}>
				{#if fieldErrors.name}<span class="ct-field-error">{fieldErrors.name}</span>{/if}
			</div>
			<div class="ct-field">
				<label for="ct-subject">Đối tượng hợp đồng</label>
				<input id="ct-subject" type="text" bind:value={form.subject} placeholder="VD: TBS, LHH (trùng với nơi giao)" class:ct-invalid={fieldErrors.subject}>
				{#if fieldErrors.subject}<span class="ct-field-error">{fieldErrors.subject}</span>{/if}
			</div>
			<div class="ct-field">
				<label for="ct-target">Khối lượng cần giao (kg)</label>
				<input id="ct-target" type="number" bind:value={form.targetWeightKg} min="0" class:ct-invalid={fieldErrors.targetWeightKg}>
				{#if fieldErrors.targetWeightKg}<span class="ct-field-error">{fieldErrors.targetWeightKg}</span>{/if}
			</div>
			<div class="ct-field">
				<label for="ct-price">Đơn giá (1000đ/kg)</label>
				<input id="ct-price" type="number" bind:value={form.pricePerKg} min="0" placeholder="VD: 200 = 200.000đ/kg" class:ct-invalid={fieldErrors.pricePerKg}>
				{#if fieldErrors.pricePerKg}<span class="ct-field-error">{fieldErrors.pricePerKg}</span>{/if}
			</div>
			<div class="ct-field">
				<label for="ct-start">Ngày bắt đầu</label>
				<input id="ct-start" type="date" bind:value={form.startDate} class:ct-invalid={fieldErrors.startDate}>
				{#if fieldErrors.startDate}<span class="ct-field-error">{fieldErrors.startDate}</span>{/if}
			</div>
			<div class="ct-field">
				<label for="ct-end">Ngày kết thúc</label>
				<input id="ct-end" type="date" bind:value={form.endDate} class:ct-invalid={fieldErrors.endDate}>
				{#if fieldErrors.endDate}<span class="ct-field-error">{fieldErrors.endDate}</span>{/if}
			</div>
			<div class="ct-field ct-field-full">
				<label for="ct-notes">Ghi chú</label>
				<textarea id="ct-notes" bind:value={form.notes} rows="2"></textarea>
			</div>
		</div>
		<div class="ct-form-actions">
			<button class="ct-btn" onclick={resetForm}>Huỷ</button>
			<button class="ct-btn ct-btn-primary" onclick={handleSave} disabled={saving || formInvalid}>
				{saving ? 'Đang lưu...' : 'Lưu'}
			</button>
		</div>
	</div>
{/if}

{#if loading}
	<div class="ct-loading">Đang tải hợp đồng...</div>
{:else if contracts.length === 0}
	<div class="ct-empty">Chưa có hợp đồng nào. Bấm "Thêm hợp đồng" để tạo mới.</div>
{:else}
	<div class="ct-list">
		{#each contracts as c}
			{@const color = statusColor(c)}
			<div class="ct-card ct-{color}">
				<div class="ct-card-top">
					<div class="ct-card-info">
						<div class="ct-card-name">{c.name}</div>
						<span class="ct-subject-badge">{c.subject}</span>
						<span class="ct-status-badge ct-status-{color}">{badgeLabel(c)}</span>
						<span class="ct-date-range">{formatContractDate(c.startDate)} — {formatContractDate(c.endDate)}</span>
					</div>
					<div class="ct-card-actions">
						{#if c.status === 'active' && c.completionPct >= 100}
							<button class="ct-action-btn ct-action-complete" onclick={() => handleMarkComplete(c)}>
								Đánh dấu hoàn thành
							</button>
						{:else if c.status === 'completed' || c.status === 'closed_short'}
							<button class="ct-action-btn ct-action-reopen" onclick={() => handleReopen(c)}>
								Mở lại
							</button>
						{/if}
						<button class="ct-action-btn" onclick={() => startEdit(c)}>Sửa</button>
						<button class="ct-action-btn ct-action-del" onclick={() => handleDelete(c.id, c.name)}>Xoá</button>
					</div>
				</div>

				<div class="ct-progress-section">
					<div class="ct-progress-bar">
						<div class="ct-progress-fill ct-fill-{color}" style="width: {Math.min(c.completionPct, 100)}%"></div>
					</div>
					<div class="ct-progress-meta">
						<span class="ct-delivered">{vnd(c.deliveredWeightKg)} <span class="ct-of">/ {vnd(c.targetWeightKg)} kg</span></span>
						<span class="ct-pct ct-pct-{color}">{c.completionPct}%</span>
					</div>
				</div>

				<div class="ct-stats-row">
					<div class="ct-stat">
						<span class="ct-stat-label">Còn lại</span>
						<span class="ct-stat-value">{vnd(c.remainingKg)} kg</span>
					</div>
					<div class="ct-stat">
						<span class="ct-stat-label">Giá trị HĐ</span>
						<span class="ct-stat-value">{vnd(c.contractValueVnd)}đ</span>
					</div>
					<div class="ct-stat">
						<span class="ct-stat-label">Đơn giá</span>
						<span class="ct-stat-value">{vnd(c.pricePerKg * 1000)}đ/kg</span>
					</div>
					<div class="ct-stat">
						<span class="ct-stat-label">Thời gian</span>
						<span class="ct-stat-value" class:ct-days-warn={c.daysLeft <= 2 && c.daysLeft > 0} class:ct-days-over={c.daysLeft <= 0}>
							{c.daysLeft > 0 ? `Còn ${c.daysLeft} ngày` : 'Hết hạn'}
						</span>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	/* ── Alert banner ────────────────────────────────── */
	.ct-alert-banner {
		display: flex; align-items: center; gap: 14px;
		padding: 14px 20px; margin-bottom: 20px;
		background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
		border: 1px solid #c4b5fd; border-radius: 12px;
	}
	.ct-alert-icon {
		flex-shrink: 0; display: flex; align-items: center; justify-content: center;
		width: 28px; height: 28px; border-radius: 50%;
		background: #7c3aed; color: white; font-size: 14px; font-weight: 800;
	}
	.ct-alert-content { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; font-size: 13px; color: #5b21b6; }
	.ct-alert-content strong { font-weight: 700; color: #4c1d95; margin-right: 4px; }
	.ct-alert-detail { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 4px; }
	.ct-alert-name { font-weight: 600; }
	.ct-alert-pct { font-weight: 700; font-variant-numeric: tabular-nums; }
	.ct-alert-sep { color: #7c3aed; margin: 0 2px; }

	/* ── Error / Loading / Empty ─────────────────────── */
	.ct-error { padding: 14px 20px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 12px; color: #dc2626; margin-bottom: 16px; font-size: 14px; }
	.ct-loading, .ct-empty { text-align: center; padding: 48px 20px; color: var(--text-muted); font-size: 14px; }

	/* ── Header ──────────────────────────────────────── */
	.ct-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
	.ct-header h2 { font-size: 18px; font-weight: 700; color: var(--text); }

	/* ── Buttons ─────────────────────────────────────── */
	.ct-btn {
		padding: 8px 20px; border-radius: 10px; border: 1px solid var(--border);
		font-size: 13px; font-weight: 600; font-family: inherit;
		cursor: pointer; background: var(--white); color: var(--text-secondary);
		transition: all 0.15s;
	}
	.ct-btn:hover { border-color: var(--blue); color: var(--blue); }
	.ct-btn-primary { background: var(--blue); color: white; border-color: var(--blue); }
	.ct-btn-primary:hover { background: var(--blue-dark); border-color: var(--blue-dark); color: white; }
	.ct-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

	.ct-action-btn {
		padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border);
		font-size: 12px; font-weight: 600; font-family: inherit;
		cursor: pointer; background: var(--white); color: var(--text-muted);
		transition: all 0.15s;
	}
	.ct-action-btn:hover { border-color: var(--blue); color: var(--blue); background: var(--blue-light); }
	.ct-action-del:hover { border-color: #fca5a5; color: #ef4444; background: #fef2f2; }
	.ct-action-complete { border-color: #10b981; color: #065f46; background: #ecfdf5; }
	.ct-action-complete:hover { border-color: #10b981; color: white; background: #10b981; }
	.ct-action-reopen { border-color: #9ca3af; color: #374151; }
	.ct-action-reopen:hover { border-color: #6b7280; color: #111827; background: #f3f4f6; }

	/* ── Form ────────────────────────────────────────── */
	.ct-form-card {
		background: var(--white); border: 1px solid var(--border); border-radius: 14px;
		padding: 24px; margin-bottom: 24px; box-shadow: var(--shadow-sm);
	}
	.ct-form-card h3 { font-size: 15px; font-weight: 700; margin-bottom: 16px; color: var(--text); }
	.ct-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
	.ct-field label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; }
	.ct-field input, .ct-field textarea {
		width: 100%; padding: 9px 14px; border: 1px solid var(--border); border-radius: 10px;
		font-size: 14px; font-family: inherit; color: var(--text);
		transition: border-color 0.15s;
	}
	.ct-field input:focus, .ct-field textarea:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px rgba(18, 115, 255, 0.1); }
	.ct-field input.ct-invalid { border-color: #ef4444; background: #fef2f2; }
	.ct-field input.ct-invalid:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12); }
	.ct-field-error { display: block; margin-top: 4px; font-size: 12px; font-weight: 600; color: #dc2626; }
	.ct-field-full { grid-column: 1 / -1; }
	.ct-form-actions { display: flex; gap: 10px; justify-content: flex-end; }
	.ct-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

	/* ── Card list (single column, full width) ────────── */
	.ct-list { display: flex; flex-direction: column; gap: 14px; }

	.ct-card {
		background: var(--white); border-radius: 14px;
		padding: 20px 24px; box-shadow: var(--shadow-sm);
		border-left: 4px solid var(--blue);
		transition: box-shadow 0.15s;
	}
	.ct-card:hover { box-shadow: var(--shadow-md); }
	.ct-card.ct-warning { border-left-color: var(--amber); }
	.ct-card.ct-overdue { border-left-color: #ef4444; }
	.ct-card.ct-done { border-left-color: var(--green); }

	/* ── Card top row ────────────────────────────────── */
	.ct-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
	.ct-card-info { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.ct-card-name { font-size: 16px; font-weight: 700; color: var(--text); }
	.ct-subject-badge {
		display: inline-block; padding: 2px 10px; border-radius: 20px;
		font-size: 12px; font-weight: 700; background: var(--blue-light); color: var(--blue);
	}
	.ct-status-badge {
		display: inline-block; padding: 2px 10px; border-radius: 999px;
		font-size: 11px; font-weight: 600; border: 1px solid transparent;
	}
	.ct-status-badge.ct-status-active   { color: #374151; background: #f3f4f6; border-color: #9ca3af; }
	.ct-status-badge.ct-status-warning  { color: #78350f; background: #fef3c7; border-color: #f59e0b; }
	.ct-status-badge.ct-status-done     { color: #065f46; background: #d1fae5; border-color: #10b981; }
	.ct-status-badge.ct-status-overdue  { color: #7f1d1d; background: #fee2e2; border-color: #ef4444; }
	.ct-date-range { font-size: 12px; color: var(--text-muted); }
	.ct-card-actions { display: flex; gap: 6px; }

	/* ── Progress ─────────────────────────────────────── */
	.ct-progress-section { margin-bottom: 16px; }
	.ct-progress-bar { height: 10px; background: var(--bg); border-radius: 5px; overflow: hidden; }
	.ct-progress-fill { height: 100%; border-radius: 5px; transition: width 0.4s ease; min-width: 2px; }
	.ct-fill-active { background: linear-gradient(90deg, #60a5fa, var(--blue)); }
	.ct-fill-warning { background: linear-gradient(90deg, #fbbf24, var(--amber)); }
	.ct-fill-overdue { background: linear-gradient(90deg, #f87171, #ef4444); }
	.ct-fill-done { background: linear-gradient(90deg, #34d399, var(--green)); }

	.ct-progress-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
	.ct-delivered { font-size: 14px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
	.ct-of { font-weight: 500; color: var(--text-muted); }
	.ct-pct { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; }
	.ct-pct-active { color: var(--blue); }
	.ct-pct-warning { color: var(--amber); }
	.ct-pct-overdue { color: #ef4444; }
	.ct-pct-done { color: var(--green); }

	/* ── Stats row (horizontal) ──────────────────────── */
	.ct-stats-row {
		display: flex; gap: 32px; padding-top: 14px;
		border-top: 1px solid var(--border);
	}
	.ct-stat { display: flex; flex-direction: column; }
	.ct-stat-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
	.ct-stat-value { font-size: 13px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; white-space: nowrap; }
	.ct-days-warn { color: var(--amber); }
	.ct-days-over { color: #ef4444; font-weight: 700; }

	/* ── Responsive ──────────────────────────────────── */
	@media (max-width: 768px) {
		.ct-form-grid { grid-template-columns: 1fr; }
		.ct-header { flex-direction: column; gap: 12px; align-items: flex-start; }
		.ct-card-top { flex-direction: column; align-items: flex-start; gap: 10px; }
		.ct-stats-row { flex-wrap: wrap; gap: 16px; }
	}
</style>
