import { db } from "$lib/server/db";
import { sql } from "drizzle-orm";

/**
 *
 * @param {number} height
 * @param {string} rootId
 * @returns
 */
export async function getDoubleReferrerStrategy(height, rootId) {
	const data = await db.execute(sql`
        with recursive parents as (
            select 0 as depth, id, session_id as sessionId
            from fora.accounts
            where fora.accounts.id = ${rootId}

            union all

            select depth + 1, fora.accounts.id, fora.accounts.session_id as sessionId
            from parents join fora.accounts on parents.id = fora.accounts.referrer_id
            where depth < ${height}
        ) select * from parents order by parents.id;`);

	if (data.rowCount === 0) {
		throw new Error("Couldn't find the root account");
	}

	const dfs = /** @type {IteratorItem[]} */ (data.rows);
	return new DoubleReferrerStrategy(height, dfs);
}

/**
 * @typedef {{depth: number, id: string | undefined, sessionId: string | undefined}} IteratorItem
 */

class DoubleReferrerStrategy {
	/**
	 *
	 * @param {number} height
	 * @param {IteratorItem[]} dfs
	 */
	constructor(height, dfs) {
		this.height = height;
		this.dfs = dfs;
		this.index = dfs.length - 1;
	}

	isEmpty() {
		const maxIndex = 2 ** (this.height + 1) - 2;
		return this.index >= maxIndex;
	}

	peek() {
		const step = DoubleReferrerStrategy.bubbleStep(this.height, this.index);
		return this.dfs[this.index - step];
	}

	[Symbol.iterator]() {
		return this.iterator();
	}

	*iterator() {
		while (!this.isEmpty()) {
			/** @type IteratorItem */
			let next = yield this.peek();
			this.dfs.push(next);
			this.index += 1;
		}
	}

	/**
	 * for binary tree in pre-order array representation
	 * @param {number} depth
	 * @param {number} index
	 * @returns {number}
	 */
	static bubbleStep(depth, index) {
		const new_index = index % (2 ** depth - 1);
		if (new_index === 0) return index;
		return this.bubbleStep(depth - 1, new_index - 1);
	}
}
