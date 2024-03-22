<script>
	import { page } from "$app/stores";
	import hisotry from "$lib/assets/history.svg?raw";
	import receipt from "$lib/assets/receipt.svg?raw";
	import ticket from "$lib/assets/ticket.svg?raw";
</script>

<main>
	<slot />
	<nav>
		<a href="/fora/coupons" class:active={$page.route.id === "/fora/coupons"}>
			{@html ticket}<span>Купони</span>
		</a>
		<a href="/fora/receipts" class:active={$page.route.id === "/fora/receipts"}>
			{@html receipt}<span>Чеки</span>
		</a>
		<a href="/fora/hisotry" class:active={$page.route.id === "/fora/hisotry"}>
			{@html hisotry}<span>Історія</span>
		</a>
	</nav>
</main>

<style>
	:root {
		--color-accent: var(--color-lime-500);
		--color-text: var(--color-slate-900);
		--color-text-accent: white;
		--color-hint: var(--color-stale-400);
		--color-surface-ground: var(--color-slate-100);
		--color-surface-section: white;
		--color-surface-hover: var(--color-slate-200);
	}
	main,
	nav {
		width: 100%;
		max-width: 480px;
		margin-inline: auto;
	}
	main {
		padding-bottom: 3rem;
	}
	nav {
		position: fixed;
		bottom: 0;
		height: 3rem;
		display: flex;
		background-color: var(--color-surface-section);
		box-shadow: 0 0 0.25rem rgba(0, 0, 0, 0.2);
	}
	a {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex-grow: 1;

		color: var(--color-hint);
		text-decoration: none;
		font-weight: 500;
		font-size: 0.75rem;
		transition: background-color 0.25s ease;
	}
	.active {
		color: var(--color-accent);
	}
	a:hover {
		-webkit-tap-highlight-color: transparent;
		background-color: var(--color-surface-hover);
	}
</style>
