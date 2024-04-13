<script>
	import Barcode from "$lib/components/Barcode.svelte";
	import Qrcode from "$lib/components/Qrcode.svelte";
	import { encodeLoyaltyData, encryptLoyaltyData } from "$lib/fora/qrcode";
	import { onMount } from "svelte";

	/** @type {import('./$types').PageData} */
	export let data;

	/** @type {Promise<import("./qrkeys.json/+server").Response>} */
	const qrkeys = data.qrkeys.then((response) => {
		if (response.ok) return response.json();
		// NOTICE: SvelteKit fetch returns undefined
		// instead of throwing error while streaming
		throw new Error(response.statusText);
	});
	let qrstring = generateQRString();

	onMount(() => {
		const interval = setInterval(() => {
			qrstring = generateQRString();
		}, 60_000);
		return () => clearInterval(interval);
	});

	async function generateQRString() {
		/* prettier-ignore */
		const { keys, personalInfo: { Coupons } } = await qrkeys;
		const loyaltyData = encodeLoyaltyData(1, data.loyalty.account.sessionId, Coupons);
		return await encryptLoyaltyData(keys.posKey.id, keys.posKey.pemKey, loyaltyData);
	}
</script>

<div class="section barcode">
	{#await qrstring}
		Loading...
	{:then text}
		<Qrcode {text} />
	{:catch}
		<Barcode ean13={data.loyalty.coupon.accountId} />
	{/await}
</div>
<div class="separator"></div>
<div class="section info">
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
