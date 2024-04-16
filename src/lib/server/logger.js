import { GRAFANA_HOST, GRAFANA_USER, GRAFANA_PASSWORD } from "$env/static/private";

/**
 * @typedef {Object} Log
 * @property {"debug" | "info" | "warn" | "error"} level
 * @property {string} message
 * @property {number} timestamp
 */

export class Logger {
	/**
	 * @type {Log[]}
	 */
	logs = [];

	/**
	 * @param {string} url
	 * @param {string} user
	 * @param {string} pass
	 */
	constructor(url, user, pass) {
		this.url = url;
		this.auth = btoa(`${user}:${pass}`);
	}

	/**
	 * @param {Log["level"]} level
	 * @param {...unknown} message
	 * @returns {Log}
	 */
	format(level, ...message) {
		const strings = message.map((item) => {
			if (typeof item === "object") {
				return JSON.stringify(item);
			}
			return String(item);
		});
		return { level, message: strings.join(";"), timestamp: Date.now() };
	}

	/**
	 *
	 * @returns {Promise<unknown>}
	 */
	async flush() {
		if (!this.logs.length) return;
		const streams = this.logs.map((log) => {
			return {
				stream: { level: log.level },
				values: [[log.timestamp.toString() + "000000", log.message]],
			};
		});
		this.logs = [];

		return await fetch(`${this.url}/loki/api/v1/push`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${this.auth}`,
			},
			body: JSON.stringify({ streams }),
		});
	}

	debug(...message) {
		console.debug(message);
		this.logs.push(this.format("debug", message));
	}

	info(...message) {
		console.info(message);
		this.logs.push(this.format("info", message));
	}

	warn(...message) {
		console.warn(message);
		this.logs.push(this.format("warn", message));
	}

	error(...message) {
		console.error(message);
		this.logs.push(this.format("error", message));
	}
}

export default new Logger(GRAFANA_HOST, GRAFANA_USER, GRAFANA_PASSWORD);
