/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match(param) {
	return /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(param);
}
