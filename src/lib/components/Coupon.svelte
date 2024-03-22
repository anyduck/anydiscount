<div class="coupon">
	<div class="left"><slot name="left" /></div>
	<div class="right"><slot name="right" /></div>
</div>

<style>
	.coupon {
		display: flex;
		filter: drop-shadow(0 0 1rem rgb(0 0 0 / 0.122));
	}
	.left,
	.right {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;

		margin-block: 0.5rem;
		border-radius: 0.5rem;
		padding: 0.5rem;
		background-color: var(--color-surface-section);
	}
	.left {
		flex-grow: 1;
		color: var(--color-hint);
	}
	.left::first-line {
		font-size: 2rem;
		color: var(--color-text);
	}
	.right {
		border-left: var(--color-surface-ground) dashed 2px;
		min-width: 30%;
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>
