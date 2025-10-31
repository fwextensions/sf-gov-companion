import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
	manifest_version: 3,
	name: "SF.gov Companion",
	version: pkg.version,
	description: "Browser extension that provides information about SF.gov pages, with links to Karl for editing",
	permissions: [
		"sidePanel",
		"tabs",
		"storage",
		"scripting",
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
