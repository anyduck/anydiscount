import { AUTH_SECRET, GOOGLE_CLIENT_ID, VERCEL_URL } from "$env/static/private";
import { accounts, users } from "$lib/schema/public";
import { db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";

import { TimeSpan, createDate } from "oslo";
import { base64url } from "oslo/encoding";
import { createJWT, validateJWT } from "oslo/jwt";
import { OAuth2Client } from "oslo/oauth2";

const AUTH_KEY = new TextEncoder().encode(AUTH_SECRET);

export const google = new OAuth2Client(
	GOOGLE_CLIENT_ID,
	"https://accounts.google.com/o/oauth2/v2/auth",
	"https://oauth2.googleapis.com/token",
	{ redirectURI: `https://${VERCEL_URL}/auth/google/callback` },
);

/**
 * Generates state for OAuth2 with payload
 * @param {string} payload
 * @returns {Promise<string>}
 */
export async function generateState(payload) {
	const nonce = new Uint8Array(32);
	crypto.getRandomValues(nonce);

	const data = new TextEncoder().encode(payload);

	const algo = { name: "HMAC", hash: "SHA-256" };
	const key = await crypto.subtle.importKey("raw", AUTH_KEY, algo, false, ["sign"]);
	const hmac = new Uint8Array(await crypto.subtle.sign(algo, key, data));

	return [nonce, data, hmac].map((i) => base64url.encode(i)).join(".");
}

/**
 * Verifies and extracts payload from OAtuh2 state
 * @param {string} state
 * @returns {Promise<string | undefined>}
 */
export async function verifyState(state) {
	const [, data, hmac] = state.split(".").map((i) => base64url.decode(i));

	const algo = { name: "HMAC", hash: "SHA-256" };
	const key = await crypto.subtle.importKey("raw", AUTH_KEY, algo, false, ["verify"]);
	if (await crypto.subtle.verify(algo, key, hmac, data)) {
		return new TextDecoder().decode(data);
	}
	return undefined;
}

/**
 * @param {string} providerId
 * @param {string} providerUserId
 * @param {typeof users.$inferInsert} user
 * @returns {Promise<string>} user id
 */
export async function getOrCreateUserByProvider(providerId, providerUserId, user) {
	const providerUser = and(
		eq(accounts.providerId, providerId),
		eq(accounts.providerUserId, providerUserId),
	);
	const [account] = await db.select({ userId: accounts.userId }).from(accounts).where(providerUser);

	if (account) {
		return account.userId;
	}

	const userId = crypto.randomUUID();
	await db.transaction(async (tx) => {
		await tx.insert(users).values({ ...user, id: userId });
		await tx.insert(accounts).values({ userId, providerId, providerUserId });
	});
	return userId;
}

/**
 * Creates a stateful session in form of JWT
 * @param {string} subject user id
 * @returns {Promise<string>}
 */
export async function createSession(subject) {
	return await createJWT("HS256", AUTH_KEY, {}, { subject, expiresIn: new TimeSpan(30, "d") });
}

/**
 * Verifies a stateful session and renews it if it is close to expiration
 * @param {string} session
 * @returns {Promise<{userId?: string; newSession?: string}>}
 */
export async function verifySession(session) {
	try {
		const jwt = await validateJWT("HS256", AUTH_KEY, session);

		let newSession;
		if (jwt.subject && jwt.expiresAt && jwt.expiresAt < createDate(new TimeSpan(15, "d"))) {
			newSession = await createSession(jwt.subject);
		}
		return { userId: jwt.subject ?? undefined, newSession };
	} catch {
		return { userId: undefined, newSession: undefined };
	}
}
