<script>
	import { invalidateAll } from "$app/navigation";
	import Barcode from "$lib/components/Barcode.svelte";
	import Qrcode from "$lib/components/Qrcode.svelte";
	import { encodeLoyaltyData, encryptLoyaltyData } from "$lib/fora/qrcode";
	import { onMount } from "svelte";

	/** @type {import('./$types').PageData} */
	export let data;

	$: qrkeys = streamedFetch(data.qrkeys);
	$: qrstring = generateQRString(qrkeys);

	onMount(() => {
		const interval = setInterval(() => {
			qrkeys = qrkeys;
		}, 60_000);
		return () => clearInterval(interval);
	});

	/**
	 * Finished streamed fetch from page load function
	 * @template {Record<string, any>} JSON
	 * @param {Promise<JSON | { message: string } | undefined>} response
	 * @returns {Promise<JSON>}
	 */
	async function streamedFetch(response) {
		const data = await response;
		// NOTICE: SvelteKit fetch returns undefined
		// instead of throwing error while streaming
		if (!data || "message" in data) {
			throw new Error(data?.message || "Network Error");
		}
		return data;
	}

	/** @param {typeof qrkeys} qrkeys */
	async function generateQRString(qrkeys) {
		/* prettier-ignore */
		const { keys, personalInfo: { Coupons } } = await qrkeys;
		const loyaltyData = encodeLoyaltyData(1, data.loyalty.account.sessionId, Coupons);
		return await encryptLoyaltyData(keys.posKey.id, keys.posKey.pemKey, loyaltyData);
	}

	/** @param {string} phone */
	function formatPhone(phone) {
		return phone.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, "+$1 ($2) $3-$4");
	}
</script>

<!-- TODO: add icon and styles -->
<button on:click={() => (qrstring = Promise.reject())}>Info</button>
<button on:click={() => invalidateAll()}>Reload</button>

<section class="personal-card">
	<h1>Картка Власного Рахунку</h1>
	<span class="phone">
		{formatPhone(data.loyalty.account.phone)}
	</span>
	{#await qrstring}
		<!-- TODO: add loading animation -->
		Loading...
	{:then text}
		<Qrcode {text} />
		<span class="hint"> Відскануйте QR-код на касі, щоб <br /> застосувати балобонуси </span>
		<a role="button" href="/fora/coupons/{data.loyalty.coupon.id}/coupons">Мої пропозиції</a>
	{:catch}
		<Barcode ean13={data.loyalty.coupon.accountId} />
	{/await}
</section>
<section class="controls">
	Баланс:
	{#await qrkeys}
		<span class="balance skeleton">????? грн.</span>
	{:then { personalInfo: { Bonus: { bonusBalanceAmount } } }}
		{#if navigator?.onLine}
			<span class="balance">{bonusBalanceAmount} грн.</span>
		{/if}
	{:catch}
		<span class="balance">????? грн.</span>
	{/await}
</section>

<style>
	.personal-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;

		height: 32rem;
		padding-block: 1.5rem;
		background-color: var(--color-surface-section);
	}
	.personal-card h1 {
		font-size: 1rem;
		margin-bottom: 0;
		font-weight: 500;
	}
	.personal-card .phone {
		font-weight: 700;
		color: var(--color-accent);
	}
	.personal-card .hint {
		flex-grow: 1;
		margin-block: -5% 1rem;
		color: var(--color-hint);
	}
	.personal-card [role="button"] {
		padding: 0.5rem 4rem;
		border-radius: 1.5rem;
		text-decoration: none;
		color: var(--color-text-accent);
		background-color: var(--color-accent);
	}
	.controls {
		text-align: center;
		font-size: 1.5rem;
	}
</style>
