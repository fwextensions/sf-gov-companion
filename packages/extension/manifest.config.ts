import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
	manifest_version: 3,
	name: "SF.gov Companion",
	version: pkg.version,
	description: "Browser extension that provides information about SF.gov pages, with links to Karl for editing",
	icons: {
		"16": "src/img/favicon-16.png",
		"32": "src/img/favicon-32.png",
		"48": "src/img/favicon-48.png",
		"128": "src/img/favicon-128.png",
	},
	permissions: [
		"sidePanel",
		"tabs",
		"storage",
		"scripting",
		"cookies",
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
		default_title: "Open SF.gov Companion",
		default_icon: {
			"16": "src/img/favicon-16.png",
			"32": "src/img/favicon-32.png",
			"48": "src/img/favicon-48.png",
			"128": "src/img/favicon-128.png",
		},
	},
	side_panel: {
		default_path: "src/sidepanel/index.html",
	},
	content_scripts: [
		{
			matches: ["*://api.sf.gov/admin/*"],
			js: ["src/content/admin-preview-monitor.ts"],
			run_at: "document_idle",
		},
	],
});
