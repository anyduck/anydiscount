/// <reference types="@sveltejs/kit" />
import { build, files, version } from "$service-worker";

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener("install", (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
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
			const cache = await caches.open(CACHE);
			const response = await cache.match(url.pathname);
			if (response) return response;
		}

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
