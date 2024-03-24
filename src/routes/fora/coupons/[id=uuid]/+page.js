import { error } from "@sveltejs/kit";

/** @type {import('./$types').PageLoad} */
export async function load({ fetch, url }) {
	const response = await fetch(url);

	if (!response.ok) {
		error(404, "Not Found");
	}

	return /** @type {import("./+server").Data} */ (await response.json());
}
