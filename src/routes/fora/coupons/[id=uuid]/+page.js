import { browser, version } from "$app/environment";
import { error } from "@sveltejs/kit";

/** @type {import('./$types').PageLoad} */
export async function load({ fetch, params }) {
	/** @type {Promise<import("./qrkeys.json/+server").Response>} */
	const qrkeys = cache(fetch, `/fora/coupons/${params.id}/qrkeys.json`).then(parseJSON);

	/** @type {import("./loyalty.json/+server").Response} */
	const loyalty = await cache(fetch, `/fora/coupons/${params.id}/loyalty.json`).then(parseJSON);

	return { qrkeys, loyalty };
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

/**
 * Parses SvelteKit JSON response
 * @param {Response} response
 * @returns {Promise<any>}
 */
async function parseJSON(response) {
	const data = await response.json();
	if (response.ok) return data;
	error(response.status, data?.message || response.statusText);
}
