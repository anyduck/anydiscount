<script>
	import Coupon from "$lib/components/Coupon.svelte";
	import { enhance } from "$app/forms";

	/** @type {import('./$types').PageData} */
	export let data;

	const formatter = new Intl.DateTimeFormat("uk-UA", {
		day: "numeric",
		month: "long",
	});
</script>

<form action="" method="post" use:enhance>
	{#each data.coupons as coupon}
		<Coupon>
			<svelte:fragment slot="left">
				{coupon.discount} грн.
				<br />
				{#if coupon.isReferral}
					Покупка понад {data.minimumSpend} грн.
				{:else}
					Немає мінімальної суми
				{/if}
				<br />
				В наявності {coupon.count} шт.
			</svelte:fragment>
			<button
				slot="right"
				type="submit"
				class="action"
				formaction="?is_referral={coupon.isReferral}"
				disabled={!coupon.count}>Отримати</button
			>
		</Coupon>
	{/each}
</form>
{#await data.streamed.coupons}
	<h3 class="skeleton">Ваші купони</h3>
	<Coupon>
		<svelte:fragment slot="left">
			<span class="skeleton">Будь ласка</span><br />
			<span class="skeleton">Зачекайте поки Ваші</span><br />
			<span class="skeleton">Купони завантажуються</span>
		</svelte:fragment>
		<span slot="right" class="action skeleton">Перейти</span>
	</Coupon>
{:then coupons}
	<h3>Ваші купони</h3>
	{#each coupons as coupon (coupon.id)}
		<Coupon>
			<svelte:fragment slot="left">
				{coupon.discount} грн.
				<br />
				{#if coupon.isReferral}
					Покупка понад {data.minimumSpend} грн.
				{:else}
					Немає мінімальної суми
				{/if}
				<br />
				Дійсний до {formatter.format(coupon.expiredAt)}
			</svelte:fragment>
			<a
				slot="right"
				class="action"
				class:marked={coupon.status === "hidden"}
				data-sveltekit-preload-data="false"
				href="fora/coupon/{coupon.id}">Перейти</a
			>
		</Coupon>
	{:else}
		<h3>Отримайте нові купони ☝️</h3>
	{/each}
{/await}

<style>
	.action {
		background-color: var(--color-button-background);
		color: var(--color-button-text);
		padding: 0.5rem;
		border-radius: 1rem;
		font-size: 1rem;
		line-height: 1rem;
		font-weight: 700;
	}
	a {
		text-decoration: none;
	}
	button {
		outline: none;
		border: none;
	}
	.marked,
	button:disabled {
		background-color: var(--color-hint);
	}
</style>
