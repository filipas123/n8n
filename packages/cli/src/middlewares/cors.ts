import type { RequestHandler } from 'express';

export const corsMiddleware: RequestHandler = (req, res, next) => {
	if ('origin' in req.headers) {
		// Allow access also from frontend when developing
		res.header('Access-Control-Allow-Origin', req.headers.origin);
		res.header('Access-Control-Allow-Credentials', 'true');
		res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
		// All three x-posthog-* headers are allowed because posthog-js sends them as
		// a set, even though the backend only reads the session ID.
		res.header(
			'Access-Control-Allow-Headers',
			'Origin, X-Requested-With, Content-Type, Accept, push-ref, browser-id, anonymousid, authorization, x-authorization, x-posthog-session-id, x-posthog-distinct-id, x-posthog-window-id',
		);
	}

	if (req.method === 'OPTIONS') {
		res.writeHead(204).end();
	} else {
		next();
	}
};
