import { google } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";
import { generateCodeVerifier, generateState } from "oslo/oauth2";

/** @type {import('./$types').RequestHandler} */
export async function GET({ cookies }) {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const scopes = ["openid", "profile", "email"];

	/** @type {Parameters<typeof cookies.set>["2"]} */
	const options = { path: "/", secure: true, httpOnly: true, sameSite: "lax", maxAge: 10 * 60 };
	cookies.set("google_state", state, options);
	cookies.set("google_code_verifier", codeVerifier, options);

	redirect(302, await google.createAuthorizationURL({ state, codeVerifier, scopes }));
}
