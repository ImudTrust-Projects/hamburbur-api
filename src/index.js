export { WebSocketDurable } from './durable/websocket';
import data from './data';
import mainPage from './main-page.html';
import { handleDataManagement } from './data-manager';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (url.pathname === '/websocket') {
			const stub = env.WEBSOCKET_DURABLE.getByName('websocket');
			return await stub.fetch(request);
		}

		if (url.pathname === '/telemetry') {
			const stub = env.WEBSOCKET_DURABLE.getByName('websocket');
			return await stub.telemetry(request)
		}

		if (url.pathname === '/tracker') {
			const stub = env.WEBSOCKET_DURABLE.getByName('websocket');
			return await stub.fetch(request);
		}

		if (url.pathname === '/dashboard') {
			const stub = env.WEBSOCKET_DURABLE.getByName('websocket');
			return stub.dashboard(request);
		}

		if (url.pathname === '/banned') {
			let json = await request.json();
			let name = json.name;
			await fetch(env.GC_BANNED_WEBHOOK, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					content: `${name} was just banned by the hamburbur™ ban gun @everyone`
				})
			});
		}

		if (url.pathname === '/data') {
			let currentData = await env.DATA_KV.get('data.json', { type: 'json' });
			if (!currentData) currentData = structuredClone(data); //fallback
			return new Response(JSON.stringify(currentData), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (url.pathname === '/manage' && request.method === 'POST') {
			return handleDataManagement(request, env);
		}

		if (url.pathname === '/' || !url.pathname) {
			return new Response(mainPage, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8'
				}
			});
		}

		return new Response(JSON.stringify({
			status: 404,
			error: 'NotFound',
			message: 'The URL you\'re looking for does not exist. Some common URLs here at hamburbur.org are \'https://hamburbur.org/data\' and \'https://hamburbur.org/dashboard\'. Were you perhaps looking for those?'
		}), {
			headers: { 'Content-Type': 'application/json' },
			status: 404
		});
	}
};
