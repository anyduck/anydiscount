<script>
	import { browser } from "$app/environment";
	import Barcode from "$lib/components/Barcode.svelte";

	/** @type {import('./$types').PageData} */
	export let data;
</script>

<div class="section barcode">
	<Barcode ean_13={data.coupon.accountId.replaceAll("-", "")} />
</div>
<div class="separator"></div>
<div class="section info">
	Баланс:
	{#if browser && !navigator.onLine}
		<span class="balance skeleton">00.00 грн.</span>
	{:else}
		<span class="balance">{data.personalInfo.Bonus.bonusBalanceAmount} грн.</span>
	{/if}
</div>

<style>
	.section {
		padding: 1rem;
		border-radius: 0.5rem;
		background-color: var(--color-text-accent);
	}
	.barcode {
		padding: 2rem calc(50% - 100px);
	}
	.separator {
		position: relative;
		height: 0.2rem;
	}
	.separator::before,
	.separator::after {
		content: "";
		position: absolute;
		width: 2rem;
		height: 2rem;
		background-color: var(--color-surface-ground);
		border-radius: 1rem;
		bottom: -0.9rem;
	}
	.separator::before {
		left: -1rem;
	}
	.separator::after {
		right: -1rem;
	}
	.info {
		text-align: center;
		font-size: 1.5rem;
	}
</style>
