/** @type { import("eslint").Linter.Config } */
module.exports = {
	root: true,
	extends: ["eslint:recommended", "plugin:svelte/recommended", "prettier"],
	parserOptions: {
		sourceType: "module",
		ecmaVersion: 2024,
		extraFileExtensions: [".svelte"],
	},
	env: {
		browser: true,
		es2024: true,
		node: true,
	},
};
