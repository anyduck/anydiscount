<script>
	import Coupon from "$lib/components/Coupon.svelte";
	import { enhance } from "$app/forms";

	/** @type {import('./$types').PageData} */
	export let data;

	let filter = -1;

	$: coupons = filterCoupons(filter, data.coupons);

	/**
	 * @param {number} value
	 * @param {typeof data.coupons} coupons
	 */
	function filterCoupons(value, coupons) {
		if (value === -1) {
			return coupons;
		}
		return coupons.filter(
			(c) => parseFloat(c.discount) >= filter && parseFloat(c.discount) < filter + 50,
		);
	}

	const formatter = new Intl.DateTimeFormat("uk-UA", {
		day: "numeric",
		month: "long",
	});
</script>

<header>
	<input type="radio" id="all" name="price" value={-1} bind:group={filter} />
	<label for="all">Всі</label>
	{#each [0, 50, 100] as p}
		<input type="radio" id="price{p}" name="price" value={p} bind:group={filter} />
		<label for="price{p}">{p}-{p + 49}</label>
	{/each}
</header>

<form method="post" use:enhance>
	{#each coupons as coupon (coupon.id)}
		<Coupon>
			<svelte:fragment slot="left">
				{coupon.discount} грн.
				<br />
				{#if coupon.isReferral}
					Покупка понад {data.REFERRAL_MINIMUM_SPEND} грн.
				{:else}
					Немає мінімальної суми
				{/if}
				<br />
				Дійсний до {formatter.format(coupon.expiredAt)}
			</svelte:fragment>
			<svelte:fragment slot="right">
				<button formaction="coupons/{coupon.id}?/assign">Перейти</button>
			</svelte:fragment>
		</Coupon>
	{:else}
		<h3>Обраних купонів не знайдено</h3>
	{/each}
</form>

<style>
	header {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.5rem;
		padding: 1rem 1rem 0.5rem;
	}
	form {
		padding-inline: 1rem;
	}
	input[type="radio"] {
		display: none;
	}
	label {
		background-color: var(--color-surface-section);
		min-width: 2rem;
	}
	button,
	label {
		padding: 0.5rem 1rem;
		border-radius: 1rem;
		font-size: 1rem;
		line-height: 1rem;
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		box-shadow: 0 0 1rem rgb(0 0 0 / 0.122);
	}
	button {
		outline: none;
		border: none;
	}
	input[type="radio"]:checked + label,
	button {
		font-weight: 600;
		background-color: var(--color-accent);
		color: var(--color-text-accent);
	}
</style>
