import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
	manifest_version: 3,
	name: "SF.gov Companion",
	version: pkg.version,
	description: "Browser extension that provides content management information and administrative links for SF.gov pages via the Wagtail CMS API",
	permissions: [
		"sidePanel",
		"tabs",
		"storage",
	],
	host_permissions: [
		"*://*.sf.gov/*",
		"https://api.sf.gov/*",
	],
	background: {
		service_worker: "src/background/service-worker.ts",
		type: "module",
	},
	action: {
		default_title: "Open SF.gov CMS Info",
	},
	side_panel: {
		default_path: "src/sidepanel/index.html",
	},
});
