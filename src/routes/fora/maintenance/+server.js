/** @type {import("@sveltejs/adapter-vercel").Config} */
export const config = {
	runtime: "edge",
	split: true,
};

import { CRON_SECRET } from "$env/static/private";
import { availableBonuses, bonuses } from "$lib/schema/fora";
import { db } from "$lib/server/db";
import { sql } from "drizzle-orm";

/** @type {import("./$types").RequestHandler} */
export function GET({ request }) {
	// FIXME: find out if this requires a timing-safe comparison
	if (request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
		return new Response("Unauthorized", { status: 401 });
	}

	// FIXME: a hack to bypass vercel free-tier max duration
	return new Response(streamUntil(maintenance()));
}

async function maintenance() {
	console.log(await db.select().from(availableBonuses));

	/**
	 * @type {typeof bonuses.$inferInsert[]}
	 */
	const to_insert = [
		{
			accountId: "027-123456789-2",
			accuredOn: parseDate("01.01.2024"),
			expiredOn: parseDate("діє до 01.04.2024".replace("діє до ", "")),
			initialAmount: "+12.0",
		},
		{
			accountId: "027-123456789-2",
			accuredOn: parseDate("01.01.2023"),
			expiredOn: parseDate("діє до 01.04.2023".replace("діє до ", "")),
			initialAmount: "+50.0",
		},
	];

	await db
		.insert(bonuses)
		.values(to_insert)
		.onConflictDoUpdate({
			target: [bonuses.accountId, bonuses.accuredOn],
			set: {
				initialAmount: sql`excluded.initial_amount`,
				expiredOn: sql`excluded.expired_on`,
			},
		});
}

/**
 * Converts DMY date to ISO 8601
 * @param {string} date
 * @returns {string}
 */
function parseDate(date) {
	const [day, month, year] = date.split(".");
	return `${year}-${month}-${day}`;
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
