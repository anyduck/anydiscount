import { browser, version } from "$app/environment";
import { error } from "@sveltejs/kit";

/** @type {import('./$types').PageLoad} */
export async function load({ fetch, url }) {
	const request = new Request(url, { headers: { accept: "application/json" } });
	const response = await fetch(request);

	if (!response.ok) {
		error(404, "Not Found");
	}
	if (browser && "caches" in window) {
		const cache = await caches.open(`fora-${version}`);
		const date = response.headers.get("date");
		if (date === null) {
			// date is null after SSR embedding
			response.headers.set("date", new Date().toString());
		} else if (new Date(date) < notBeforeDate()) {
			await cache.delete(request);
			error(404, "Not Found");
		}
		await cache.put(request, response.clone());
	}

	return /** @type {import("./+server").Data} */ (await response.json());
}

function notBeforeDate() {
	const today = new Date();
	today.setUTCDate(today.getUTCDate() - 1);
	today.setUTCHours(4); // Maintenance ending hours
	return today;
}
