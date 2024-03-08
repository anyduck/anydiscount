import { AUTH_SECRET, GRAM_APIKEY } from "$env/static/private";
import { error, json } from "@sveltejs/kit";
import { SignJWT } from "jose";

import { users } from "$lib/schema/public";
import { db } from "$lib/server/db";

const AUTH_KEY = new TextEncoder().encode(AUTH_SECRET);

/** @type {import('./$types').RequestHandler} */
export async function POST({ cookies, request, url, getClientAddress }) {
	const data = await request.formData();
	// TODO: get this key only once, when top-level await is supported by es2022
	const key = await getTelegramHMACKey(GRAM_APIKEY);

	if (!(await validateWebAppData(data, key)) || !data.has("user")) {
		error(401, "Unauthorized");
	}

	/** @type {{ id: number; first_name: string; last_name?: string; }} */
	const telegramUser = JSON.parse(/** @type {string} */ (data.get("user")));
	const authDate = parseInt(/** @type {string} */ (data.get("auth_date")));

	const { id: telegramId, first_name: firstName, last_name: lastName } = telegramUser;
	const name = lastName ? `${firstName} ${lastName}` : firstName;

	const [{ userId }] = await db
		.insert(users)
		.values({ name, telegramId, signupIp: getClientAddress() })
		.onConflictDoUpdate({
			target: users.telegramId,
			set: { name: name },
		})
		.returning({ userId: users.id });

	const token = await new SignJWT()
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(url.origin)
		.setSubject(userId)
		.setExpirationTime(authDate + 24 * 3600)
		.sign(AUTH_KEY);

	cookies.set("token", token, { path: "/" });
	return json({ message: "Authorized" });
}

/**
 * Creates an HMAC key for verifying Telegram Web App data
 * @async
 * @param {string} gram_apikey Telegram Bot API key
 * @returns {Promise<CryptoKey>}
 */
async function getTelegramHMACKey(gram_apikey) {
	const encoder = new TextEncoder();
	const algo = { name: "HMAC", hash: "SHA-256" };
	const temp_raw = encoder.encode("WebAppData");
	const temp_key = await crypto.subtle.importKey("raw", temp_raw, algo, false, ["sign"]);
	const gram_raw = encoder.encode(gram_apikey);
	const hmac_raw = await crypto.subtle.sign("HMAC", temp_key, gram_raw);
	return await crypto.subtle.importKey("raw", hmac_raw, algo, false, ["verify"]);
}

/**
 * Verifies the integrity of the data from Telegram Web App
 * @param {FormData} formData
 * @param {CryptoKey} gram_key
 * @returns {Promise<boolean>}
 */
function validateWebAppData(formData, gram_key) {
	const { hash, ...data } = Object.fromEntries(formData.entries());

	if (typeof hash !== "string" || hash.length !== 64 || /[^a-f0-9]/i.test(hash)) {
		return new Promise((resolve) => resolve(false));
	}

	const checkString = Object.keys(data)
		.sort()
		.map((key) => `${key}=${data[key]}`)
		.join("\n");
	const checkData = new TextEncoder().encode(checkString);

	return crypto.subtle.verify("HMAC", gram_key, hex2bin(hash), checkData);
}

/**
 * Decodes a hexadecimal-encoded string into a Uint8Array
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hex2bin(hex) {
	const result = new Uint8Array(Math.ceil(hex.length / 2));
	for (let i = 0; i < result.length; i++) {
		result[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
	}
	return result;
}
