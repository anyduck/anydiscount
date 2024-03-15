/** @type {import("@sveltejs/adapter-vercel").Config} */
export const config = {
	runtime: "edge",
	split: true,
};

import { CRON_SECRET } from "$env/static/private";
import { maintenance } from "./maintenance";

/** @type {import("./$types").RequestHandler} */
export function GET({ request }) {
	if (request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
		return new Response("Unauthorized", { status: 401 });
	}

	// FIXME: a hack to bypass vercel free-tier max duration
	return new Response(streamUntil(maintenance()));
}

/**
 * Streams ASCII dots until the promise is settled
 * @param {Promise<unknown>} promise
 * @returns {ReadableStream}
 */
function streamUntil(promise) {
	let is_running = true;
	promise.finally(() => {
		is_running = false;
	});
	return new ReadableStream({
		async start(controller) {
			const dot = new Uint8Array([46]);
			while (is_running) {
				controller.enqueue(dot);
				await sleep(10 * 1_000);
			}
			controller.enqueue(new Uint8Array([33]));
			controller.close();
		},
	});
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}
