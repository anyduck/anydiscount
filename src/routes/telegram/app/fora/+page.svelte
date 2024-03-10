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

<form method="post" use:enhance>
	<Coupon>
		<svelte:fragment slot="left">
			50+ грн.<br />
			Немає мінімальної суми<br />
			В наявності {data.counts.required_nothing} шт.
		</svelte:fragment>
		<button
			slot="right"
			formaction="?required_spend=0.00"
			type="submit"
			class="action"
			disabled={data.counts.required_nothing === 0}
		>
			Отримати
		</button>
	</Coupon>
	<Coupon>
		<svelte:fragment slot="left">
			0 або 100 грн.<br />
			Покупка понад 100 грн.<br />
			В наявності {data.counts.required_hundred} шт.
		</svelte:fragment>
		<button
			slot="right"
			type="submit"
			formaction="?required_spend=100.00"
			class="action"
			disabled={data.counts.required_hundred === 0}
		>
			Отримати
		</button>
	</Coupon>
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
				{coupon.totalDiscount} грн.
				<br />
				{#if parseFloat(coupon.requiredSpend)}
					Покупка понад {coupon.requiredSpend} грн.
				{:else}
					Немає мінімальної суми
				{/if}
				<br />
				Дійсний до {formatter.format(coupon.expiredAt)}
			</svelte:fragment>
			<a
				slot="right"
				class="action"
				class:marked={coupon.status === "awaiting_receipt"}
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
