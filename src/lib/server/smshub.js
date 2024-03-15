import { RetryError, retry, sleep } from "$lib/retry";

const SMSHUB_APIURL = "https://smshub.org/stubs/handler_api.php";

/**
 * Requests a phone number for the specified service and country
 * @param {string} apiKey
 * @param {keyof SERVICE} service
 * @param {keyof COUNTRY} country
 * @returns {Promise<PhoneNumber>}
 */
export async function getPhoneNumber(apiKey, service, country) {
	const response = await retry(() =>
		request({ action: "getNumber", service: SERVICE[service], country: COUNTRY[country] }, apiKey),
	);
	const [text, id, number] = response.split(":");

	if (text !== "ACCESS_NUMBER") {
		throw new Error("Unknow error");
	}
	return new PhoneNumber(apiKey, id, number);
}

/** Available services */
const SERVICE = /** @type {const} */ ({
	fora: "gu",
});

/** Available countries */
const COUNTRY = /** @type {const} */ ({
	ukraine: "1",
});

/** Number statuses */
const STATUS = {
	ACCESS_READY: "1",
	ACCESS_RETRY_GET: "3",
	ACCESS_ACTIVATION: "6",
	ACCESS_CANCEL: "8",
};

/** All possible errors */
const ERRORS = {
	SERVER_ERROR: "Server error",
	BANNED: "Account banned",
	NO_KEY: "Key is empty",
	BAD_KEY: "Invalid API key",
	ERROR_SQL: "Server database error",
	BAD_ACTION: "General query malformed",
	WRONG_SERVICE: "Wrong service identifier",
	BAD_SERVICE: "Wrong service name",
	NO_ACTIVATION: "Activation not found.",
	NO_BALANCE: "No balance",
	NO_NUMBERS: "No numbers",
	API_KEY_NOT_VALID: "Invalid API key status",
};

export class PhoneNumber {
	/**
	 * @param {string} apiKey
	 * @param {string} id
	 * @param {string} number
	 */
	constructor(apiKey, id, number) {
		this.apiKey = apiKey;
		this.id = id;
		this.number = number;
	}

	/** Returns the SMS code */
	async getCode() {
		for (;;) {
			const response = await request({ action: "getStatus", id: this.id }, this.apiKey);
			const [status, code] = response.split(":");

			switch (status) {
				case "STATUS_OK":
					return code;
				case "STATUS_WAIT_CODE":
				case "STATUS_WAIT_RETRY":
					await sleep(5_000);
					break;
				case "STATUS_CANCEL":
				default:
					throw new Error(status);
			}
		}
	}

	/**
	 *
	 */
	async cancel() {
		await request({ action: "setStatus", id: this.id, status: STATUS.ACCESS_CANCEL }, this.apiKey);
	}
}

/**
 * Makes a request to the API service and checks for errors
 * @param {Record<string, string>} query - The query string parameters
 * @param {string} api_key - The query string parameters
 * @throws Will throw an error if response contains {@link ERRORS} from API
 * @returns {Promise<string>}
 */
async function request(query, api_key) {
	const url = new URL(SMSHUB_APIURL);
	url.search = new URLSearchParams({ ...query, api_key }).toString();

	const response = await fetch(url);
	const text = await response.text();

	const [first] = text.split(":");
	if (Object.keys(ERRORS).includes(first)) {
		const message = ERRORS[/** @type {keyof typeof ERRORS} */ (first)];
		if (first === "NO_NUMBERS") {
			throw new RetryError(message);
		}
		throw new Error(message);
	}
	return text;
}
