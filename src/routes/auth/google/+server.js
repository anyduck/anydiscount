import { google, generateState } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";
import { generateCodeVerifier } from "oslo/oauth2";

/** @type {import('./$types').RequestHandler} */
export async function GET({ cookies, request }) {
	const state = await generateState(request.headers.get("referer") ?? "/");
	const codeVerifier = generateCodeVerifier();
	const scopes = ["openid", "profile", "email"];

	cookies.set("google_state", state, { path: "/", maxAge: 10 * 60 });
	cookies.set("google_code_verifier", codeVerifier, { path: "/", maxAge: 10 * 60 });

	redirect(302, await google.createAuthorizationURL({ state, codeVerifier, scopes }));
}
