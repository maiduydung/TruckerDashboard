<script lang="ts">
	import "../app.css";
	import favicon from "$lib/assets/favicon.svg";
	import { auth } from "$lib/auth.svelte";
	import { onMount } from "svelte";

	let { children } = $props();
	let googleBtnContainer: HTMLDivElement | undefined = $state();

	onMount(() => {
		auth.init();
	});

	function renderGoogleButton() {
		if (!googleBtnContainer) return;
		const google = (window as any).google;
		if (!google?.accounts?.id) {
			setTimeout(renderGoogleButton, 100);
			return;
		}
		google.accounts.id.initialize({
			client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
			callback: auth.handleCredentialResponse,
		});
		google.accounts.id.renderButton(googleBtnContainer, {
			type: "standard",
			theme: "outline",
			size: "large",
			text: "signin_with",
			shape: "rectangular",
			width: 300,
		});
	}

	$effect(() => {
		if (
			(auth.status === "logged-out" || auth.status === "denied") &&
			googleBtnContainer
		) {
			renderGoogleButton();
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Nhu Tin Trucker Dashboard</title>
</svelte:head>

{#if auth.status === "loading"}
	<div class="auth-page">
		<div class="auth-card">
			<div class="loading-spinner"></div>
		</div>
	</div>
{:else if auth.status === "authorized"}
	<div class="user-bar">
		<div class="user-info">
			<img src={auth.user?.picture} alt="" class="user-avatar" />
			<span class="user-email">{auth.user?.email}</span>
		</div>
		<button class="logout-btn" onclick={auth.logout}>Đăng xuất</button>
	</div>
	{@render children()}
{:else if auth.status === "denied"}
	<div class="auth-page">
		<div class="auth-card">
			<div class="denied-icon">&#x26D4;</div>
			<h1>Từ chối truy cập</h1>
			<p class="denied-msg">
				Tài khoản <strong>{auth.user?.email}</strong> không được phép truy
				cập.
			</p>
			<p class="denied-sub">Liên hệ quản trị viên để được cấp quyền.</p>
			<button class="btn-back" onclick={auth.logout}
				>Quay lại đăng nhập</button
			>
		</div>
	</div>
{:else}
	<div class="auth-page">
		<div class="auth-card">
			<h1><span class="logo-accent">Nhu Tin</span> Trucker Dashboard</h1>
			<p class="auth-subtitle">Đăng nhập để tiếp tục</p>
			<div class="google-btn-wrap" bind:this={googleBtnContainer}></div>
		</div>
	</div>
{/if}

<style>
	.auth-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%);
	}

	.auth-card {
		background: white;
		border-radius: 20px;
		padding: 48px 40px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
		text-align: center;
		max-width: 400px;
		width: 100%;
	}

	.auth-card h1 {
		font-size: 28px;
		font-weight: 800;
		color: var(--text);
		letter-spacing: -0.5px;
		margin-bottom: 8px;
	}

	.auth-subtitle {
		color: var(--text-muted);
		font-size: 14px;
		margin-bottom: 32px;
	}

	.google-btn-wrap {
		display: flex;
		justify-content: center;
	}

	/* Denied */
	.denied-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}

	.denied-msg {
		color: var(--text-secondary);
		font-size: 14px;
		margin-top: 12px;
	}

	.denied-sub {
		color: var(--text-muted);
		font-size: 13px;
		margin-top: 8px;
		margin-bottom: 24px;
	}

	.btn-back {
		padding: 10px 28px;
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		background: white;
		color: var(--text);
		transition: all 0.15s;
	}

	.btn-back:hover {
		background: var(--blue);
		color: white;
		border-color: var(--blue);
	}

	/* User bar */
	.user-bar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		padding: 8px 24px;
		background: white;
		border-bottom: 1px solid var(--border);
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.user-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
	}

	.user-email {
		font-size: 13px;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.logout-btn {
		padding: 5px 14px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		background: white;
		color: var(--text-muted);
		transition: all 0.15s;
	}

	.logout-btn:hover {
		color: #dc2626;
		border-color: #fecaca;
		background: #fef2f2;
	}

	/* Loading spinner */
	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border);
		border-top-color: var(--blue);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
