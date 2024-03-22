import { GOOGLE_CLIENT_SECRET } from "$env/static/private";
import { COOKIE_NAME, createSession, getOrCreateUserByProvider, google } from "$lib/server/auth";
import { error, redirect } from "@sveltejs/kit";
import { parseJWT } from "oslo/jwt";

/** @type {import('./$types').RequestHandler} */
export async function GET({ cookies, getClientAddress, url }) {
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");

	const storedState = cookies.get("google_state");
	const storedCodeVerifier = cookies.get("google_code_verifier");

	if (!code || !storedState || !storedCodeVerifier || state !== storedState) {
		error(400, "Invalid request");
	}

	let tokens;
	try {
		tokens = await google.validateAuthorizationCode(code, {
			codeVerifier: storedCodeVerifier,
			credentials: GOOGLE_CLIENT_SECRET,
		});
	} catch {
		error(400, "Invalid credentials");
	}

	if (!("id_token" in tokens) || typeof tokens.id_token !== "string") {
		throw new Error("Missing Google OAuth scopes");
	}

	const jwt = parseJWT(tokens.id_token);

	if (!jwt?.subject || !("name" in jwt.payload) || typeof jwt.payload.name !== "string") {
		throw new Error("Missing Google OAuth scopes");
	}

	const userId = await getOrCreateUserByProvider("google", jwt.subject, {
		name: jwt.payload.name,
		signupIp: getClientAddress(),
	});
	const session = await createSession(userId);

	cookies.set(COOKIE_NAME, session, {
		path: "/",
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		maxAge: 30 * 24 * 3600,
	});

	redirect(302, "/app");
}
