<script>
	import { enhance } from "$app/forms";
	import Barcode from "$lib/components/Barcode.svelte";
	import { onMount } from "svelte";

	/** @type {import('./$types').PageData} */
	export let data;

	/** @type {HTMLInputElement} */
	let submit;

	$: isAssigned = data.coupon.status === "assigned";

	onMount(() => {
		window.Telegram.WebApp.expand();

		const back = () => window.history.back();
		window.Telegram.WebApp.BackButton.onClick(back);
		window.Telegram.WebApp.BackButton.show();

		const mark = () => submit.click();
		window.Telegram.WebApp.MainButton.onClick(mark);
		const styles = getComputedStyle(document.body);
		window.Telegram.WebApp.MainButton.setParams({
			color: styles.getPropertyValue("--color-button-background"),
			text_color: styles.getPropertyValue("--color-button-text"),
			text: "ПОЗНАЧИТИ ВИКОРИСТАНИМ",
			is_visible: isAssigned,
		});

		return () => {
			window.Telegram.WebApp.MainButton.hide();
			window.Telegram.WebApp.BackButton.hide();
			window.Telegram.WebApp.MainButton.offClick(mark);
			window.Telegram.WebApp.BackButton.offClick(back);
		};
	});
</script>

<div class="section barcode">
	<Barcode ean_13={data.coupon.accountId.replaceAll("-", "")} />
</div>
<div class="separator"></div>
<div class="section info">
	Баланс: <span class="balance skeleton">00.00 грн.</span>
	<form action="" method="post" use:enhance>
		<input type="submit" bind:this={submit} on:click={window.Telegram.WebApp.MainButton.hide} />
	</form>
</div>

<style>
	.section {
		padding: 1rem;
		border-radius: 0.5rem;
		background-color: var(--color-section);
	}
	.barcode {
		padding: 2rem calc(50% - 100px);
	}
	.separator {
		position: relative;
		height: 0.2rem;
	}
	.separator::before,
	.separator::after {
		content: "";
		position: absolute;
		width: 2rem;
		height: 2rem;
		background-color: var(--color-background);
		border-radius: 1rem;
		bottom: -0.9rem;
	}
	.separator::before {
		left: -1rem;
	}
	.separator::after {
		right: -1rem;
	}
	.info {
		text-align: center;
		font-size: 1.5rem;
	}
	form {
		display: none;
	}
</style>
