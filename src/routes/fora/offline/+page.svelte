<script>
	import { version } from "$app/environment";
	import offline from "$lib/assets/offline.svg?raw";
	import Coupon from "$lib/components/Coupon.svelte";
	import { onMount } from "svelte";

	/** @type {import("../coupons/[id=uuid]/loyalty.json/+server").Response["coupon"][]} */
	let coupons = [];
	const expiredAt = new Date();

	onMount(async () => {
		const cache = await caches.open(`fora-${version}`);
		const notBefore = notBeforeDate();

		for (const response of await cache.matchAll()) {
			if (new Date(response.headers.get("date") ?? 0) < notBefore) {
				await cache.delete(response.url, { ignoreVary: true });
			} else if (response.url.includes("loyalty.json")) {
				coupons = [...coupons, (await response.json()).coupon];
			}
		}
	});

	function notBeforeDate() {
		const today = new Date();
		const MAINTENANCE_HOUR = 4;
		if (today.getUTCHours() < MAINTENANCE_HOUR) {
			today.setUTCDate(today.getUTCDate() - 1);
		}
		today.setUTCHours(MAINTENANCE_HOUR);
		return today;
	}

	/** @param {string} status */
	function getLabel(status) {
		switch (status) {
			case "assigned":
				return "Отриманий";
			case "hidden":
				return "Прихований";
		}
		return "Невідомо";
	}
</script>

<section>
	<h1>{@html offline} Сервер не відповідає</h1>
	{#each coupons as { id, status, discount, isReferral } (id)}
		<Coupon {discount} minimumSpend={isReferral ? "100" : ""} {expiredAt}>
			<a href="coupons/{id}">{getLabel(status)}</a>
		</Coupon>
	{/each}
</section>

<style>
	section {
		padding-inline: 1rem;
	}
</style>
