import { redirect } from "@sveltejs/kit";
import { AUTH_SECRET } from "$env/static/private";
import { jwtVerify } from "jose";

const AUTH_KEY = new TextEncoder().encode(AUTH_SECRET);

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const token = event.cookies.get("token") ?? "";

	try {
		const result = await jwtVerify(token, AUTH_KEY);
		event.locals.userId = result.payload.sub;
	} catch {
		const pathname = event.url.pathname;
		if (pathname !== "/telegram/app/auth" && pathname.startsWith("/telegram/app")) {
			redirect(302, `/telegram/app/auth?return_to=${pathname}`);
		}
	}

	return await resolve(event);
}
