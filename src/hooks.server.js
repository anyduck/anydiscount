import { COOKIE_NAME, verifySession } from "$lib/server/auth";

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const session = event.cookies.get(COOKIE_NAME);

	if (!session) {
		return resolve(event);
	}

	const { userId, newSession } = await verifySession(session);

	event.locals.userId = userId;

	if (!userId) {
		event.cookies.delete(COOKIE_NAME, { path: "/" });
	} else if (newSession) {
		event.cookies.set(COOKIE_NAME, newSession, {
			path: "/",
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			maxAge: 30 * 24 * 3600,
		});
	}

	return resolve(event);
}
