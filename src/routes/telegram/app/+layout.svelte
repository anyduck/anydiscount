<svelte:head>
	<script src="https://telegram.org/js/telegram-web-app.js"></script>
	<script>
		window.Telegram.WebApp.setHeaderColor("#f1f1f1");
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
	:global(body) {
		background-color: var(--color-background);
	}
</style>
