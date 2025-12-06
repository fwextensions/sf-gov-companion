/**
 * Lightweight dev server that bypasses vercel dev overhead.
 * Run with: npm run dev
 */
import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse as parseUrl } from "url";

// dynamically import handlers
async function loadHandler(name: string) {
	const mod = await import(`./api/${name}.ts`);
	return mod.default;
}

// convert Node req/res to Vercel-like objects
function createVercelRequest(req: IncomingMessage, query: Record<string, string | string[] | undefined>) {
	return {
		method: req.method,
		headers: req.headers,
		query,
		body: null,
	};
}

function createVercelResponse(res: ServerResponse) {
	const vercelRes: any = {
		statusCode: 200,
		_headers: {} as Record<string, string>,
		setHeader(name: string, value: string) {
			this._headers[name] = value;
			res.setHeader(name, value);
			return this;
		},
		status(code: number) {
			this.statusCode = code;
			return this;
		},
		json(data: any) {
			res.writeHead(this.statusCode, { "Content-Type": "application/json", ...this._headers });
			res.end(JSON.stringify(data));
			return this;
		},
		end() {
			res.writeHead(this.statusCode, this._headers);
			res.end();
			return this;
		},
	};
	return vercelRes;
}

const server = createServer(async (req, res) => {
	const startTime = Date.now();
	const parsed = parseUrl(req.url || "/", true);
	const pathname = parsed.pathname || "/";

	// CORS preflight
	const origin = req.headers.origin as string | undefined;
	if (origin) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Wagtail-Session, X-SF-Gov-Extension");
	}

	if (req.method === "OPTIONS") {
		res.writeHead(200);
		res.end();
		return;
	}

	// route to handlers
	const routes: Record<string, string> = {
		"/api/feedback": "feedback",
		"/api/health": "health",
		"/api/test": "test",
	};

	const handlerName = routes[pathname];
	if (!handlerName) {
		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Not found" }));
		return;
	}

	try {
		const handler = await loadHandler(handlerName);
		const vercelReq = createVercelRequest(req, parsed.query as Record<string, string>);
		const vercelRes = createVercelResponse(res);
		await handler(vercelReq, vercelRes);
		console.log(`${req.method} ${pathname} - ${Date.now() - startTime}ms`);
	} catch (error) {
		console.error("Handler error:", error);
		res.writeHead(500, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Internal server error" }));
	}
});

const PORT = 3000;
server.listen(PORT, () => {
	console.log(`Dev server running at http://localhost:${PORT}`);
});
