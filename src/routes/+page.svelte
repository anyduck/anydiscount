<section style="--color-accent: orange">
	<header data-watermark="Сільпо">Купони</header>
	<form method="post" action="/silpo/coupons/random">
		<h2>Від 10 до 100 грн</h2>
		<button type="submit" disabled>Може скоро</button>
	</form>
	<footer>
		<a href="#">Переглянути всі купони</a>
	</footer>
</section>

<section style="--color-accent: var(--color-lime-500)">
	<header data-watermark="Фора">Купони</header>
	<form method="post" action="/fora/coupons/random">
		<h2>Від 0 до 100 грн</h2>
		<button type="submit">Випадковий</button>
	</form>
	<footer>
		<a href="/fora/coupons">Переглянути всі купони</a>
	</footer>
</section>

<style>
	section {
		max-width: 480px;
		margin-inline: auto;
		padding-inline: 1rem;
		margin-top: 5rem;
	}
	header {
		text-align: right;
		font-weight: 900;
		font-size: 2rem;
		position: relative;
	}
	header::before {
		content: attr(data-watermark);
		text-transform: uppercase;
		font-weight: 900;
		font-size: 6rem;
		color: var(--color-surface-ground);
		text-shadow:
			+1px +1px 0 var(--color-accent),
			-1px -1px 0 var(--color-accent),
			+1px -1px 0 var(--color-accent),
			-1px +1px 0 var(--color-accent),
			+1px +1px 0 var(--color-accent);

		position: absolute;
		left: 0;
		top: -100%;
		z-index: -1;
	}
	footer {
		margin-top: 1rem;
		text-align: center;
	}
	a {
		color: var(--color-blue-500);
	}
	form {
		display: flex;
		justify-content: space-around;
		align-items: center;
		background-color: var(--color-surface-section);
		border-radius: 0.25rem;
		height: 7rem;
		box-shadow: 0 0 1rem rgb(0 0 0 / 0.122);
	}
	button {
		background-color: var(--color-text);
		color: var(--color-text-accent);
		box-shadow: 0 0 1rem rgb(0 0 0 / 0.122);

		padding: 0.5rem 1rem;
		border-radius: 1rem;
		font-size: 1rem;
		line-height: 1rem;

		font-weight: 600;
		cursor: pointer;
		border: none;
		-webkit-tap-highlight-color: transparent;
	}
	button:disabled {
		pointer-events: none;
		opacity: 0.3;
	}
</style>
