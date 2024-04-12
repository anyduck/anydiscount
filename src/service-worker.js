/// <reference types="@sveltejs/kit" />
import { build, files, prerendered, version } from "$service-worker";

const ASSETS = [...build, ...files, ...prerendered];

self.addEventListener("install", (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(`assets-${version}`);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener("activate", (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (!key.endsWith(version)) {
				await caches.delete(key);
			}
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;

	async function respond() {
		try {
			return await fetch(event.request);
		} catch (error) {
			const response = await caches.match(event.request);
			if (response) return response;
			throw error;
		}
	}

	event.respondWith(respond());
});
