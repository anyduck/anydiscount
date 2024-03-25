<script>
	import Coupon from "$lib/components/Coupon.svelte";
	export let data;

	const minimumSpend = data.REFERRAL_MINIMUM_SPEND.toString();

	/** @param {string} status */
	function getLabel(status) {
		switch (status) {
			case "canceled":
				return "Скасований";
			case "assigned":
				return "Отриманий";
			case "hidden":
				return "Прихований";
			case "applied":
				return "Застосований";
		}
		return "Невідомо";
	}
</script>

<section>
	{#each data.coupons as { id, status, discount, isReferral, expiredAt } (id)}
		<Coupon {discount} minimumSpend={isReferral ? minimumSpend : ""} {expiredAt}>
			{#if status !== "assigned" && status !== "hidden"}
				<div class="rotated">{getLabel(status)}</div>
			{:else}
				<a href="coupons/{id}">{getLabel(status)}</a>
			{/if}
		</Coupon>
	{:else}
		<h3>Історія порожня</h3>
	{/each}
</section>

<style>
	section {
		padding-inline: 1rem;
	}
	.rotated {
		transform: rotate(-45deg);
		color: var(--color-hint);
	}
	a {
		padding: 0.5rem 1rem;
		border-radius: 1rem;
		font-size: 1rem;
		line-height: 1rem;

		text-decoration: none;
		-webkit-tap-highlight-color: transparent;

		font-weight: 600;
		background-color: var(--color-accent);
		color: var(--color-text-accent);
		box-shadow: 0 0 1rem rgb(0 0 0 / 0.122);
	}
</style>
