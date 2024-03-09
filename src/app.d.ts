// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import { Telegram } from "@twa-dev/types";
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			userId: string | undefined;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	interface Window {
		Telegram: Telegram;
	}
}

export {};
