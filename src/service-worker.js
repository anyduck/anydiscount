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
		const url = new URL(event.request.url);
		if (ASSETS.includes(url.pathname)) {
			const cache = await caches.open(`assets-${version}`);
			const response = await cache.match(url.pathname);
			if (response) return response;
		}

		try {
			return await fetch(event.request);
		} catch (error) {
			if (url.pathname.startsWith("/fora")) {
				const cache = await caches.open(`fora-${version}`);
				const response = await cache.match(event.request);
				if (response) return response;
			}
			throw error;
		}
	}

	event.respondWith(respond());
});
