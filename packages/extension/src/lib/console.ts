/**
 * Disable console.log in production builds
 */
declare const __DEV__: boolean;

if (!__DEV__) {
	console.log = () => {};
}
