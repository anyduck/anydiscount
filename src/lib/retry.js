/**
 * @template T
 * @param {() => Promise<T>} action
 * @param {number} [interval=5_000]
 * @param {number} [count=3]
 * @returns {Promise<T>}
 */
export async function retry(action, interval = 5_000, count = 3) {
	for (let attempted = 0; attempted < count; attempted++) {
		try {
			return await action();
		} catch (error) {
			if (error instanceof RetryError) {
				console.error(error);
				await sleep(interval);
			} else {
				throw error;
			}
		}
	}
	throw new Error("Out Of Retries");
}

export class RetryError extends Error {
	/** @param {string} message  */
	constructor(message) {
		super(message);
		this.name = "RetryError";
	}
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}
