<script>
	import { onMount } from "svelte";

	onMount(() => {
		// Telegram for Android doesn't set header color from onMount
		window.Telegram.WebApp.setHeaderColor("#f1f1f1");
		document.body.style.backgroundColor = "#f1f1f1";
	});
</script>

<svelte:head>
	<script src="https://telegram.org/js/telegram-web-app.js"></script>
	<script>
		window.Telegram.WebApp.setHeaderColor("#f1f1f1");
		// Telegram for Android doesn't set background color on DOMContentLoaded
		window.addEventListener("DOMContentLoaded", () => {
			document.body.style.backgroundColor = "#f1f1f1";
		});
	</script>
</svelte:head>

<slot />

<style>
	:global(*) {
		font-family: sans-serif;
	}
	:global(:root) {
		--color-text: #000000;
		--color-hint: #999999;
		--color-button-background: #56e625;
		--color-button-text: #ffffff;
		--color-section: #ffffff;
		--color-background: #f1f1f1;
	}
</style>
