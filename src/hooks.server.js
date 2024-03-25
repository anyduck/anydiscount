import { verifySession } from "$lib/server/auth";

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const session = event.cookies.get("auth_session");

	if (!session) {
		return resolve(event);
	}

	const { userId, newSession } = await verifySession(session);

	event.locals.userId = userId;

	if (!userId) {
		event.cookies.delete("auth_session", { path: "/" });
	} else if (newSession) {
		event.cookies.set("auth_session", newSession, { path: "/", maxAge: 30 * 24 * 3600 });
	}

	return resolve(event);
}
