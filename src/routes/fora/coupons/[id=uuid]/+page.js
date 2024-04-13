import { browser, version } from "$app/environment";
import { error } from "@sveltejs/kit";

/** @type {import('./$types').PageLoad} */
export async function load({ fetch, params }) {
	const qrkeys = cache(fetch, `/fora/coupons/${params.id}/qrkeys.json`);
	const loyalty = await cache(fetch, `/fora/coupons/${params.id}/loyalty.json`);

	if (!loyalty.ok) {
		/** @type {{message: string}} */
		const data = await loyalty.json();
		error(loyalty.status, data.message);
	}

	/** @type {import("./loyalty.json/+server").Response} */
	const loyaltyData = await loyalty.json();
	return { qrkeys, loyalty: loyaltyData };
}

/**
 * Caches SvelteKit route
 * @param {typeof fetch} fetch
 * @param {string | URL} input
 * @returns {Promise<Response>}
 */
async function cache(fetch, input) {
	const response = await fetch(input);
	if (response.headers.get("date") === null) {
		response.headers.set("date", new Date().toString());
	}
	if (response.ok && browser && "caches" in window) {
		const cache = await caches.open(`fora-${version}`);
		await cache.put(input, response.clone());
	}
	return response;
}
