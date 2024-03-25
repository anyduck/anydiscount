import { browser, version } from "$app/environment";
import { error } from "@sveltejs/kit";

const CACHE = `fora-${version}`;

/** @type {import('./$types').PageLoad} */
export async function load({ fetch, url }) {
	const response = await fetch(url);

	if (!response.ok) {
		error(404, "Not Found");
	}
	if (browser && "caches" in window) {
		const cache = await caches.open(CACHE);
		const date = response.headers.get("date");
		if (new Date(date ?? 0) < notBeforeDate()) {
			await cache.delete(url);
		} else {
			await cache.put(url, response.clone());
		}
	}

	return /** @type {import("./+server").Data} */ (await response.json());
}

function notBeforeDate() {
	const today = new Date();
	today.setUTCDate(today.getUTCDate() - 1);
	today.setUTCHours(4); // Maintenance ending hours
	return today;
}
