export { WebSocketDurable } from './durable/websocket';
import data from './data/data.json';
import mainPage from './main-page.html';
import { handleDataManagement } from './data/data-manager';
import { uploadTrackingData, uploadS3RoomData } from './tracker/tracker-manager';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const webSocketDurableStub = env.WEBSOCKET_DURABLE.getByName('websocket');

		if (url.pathname === '/websocket') {
			return await webSocketDurableStub.fetch(request);
		}

		if (url.pathname.startsWith('/tracker')) {
			const other = url.pathname.replace('/tracker', '');
			switch (other) {
				case '/upload':
					return await uploadTrackingData(request, env);

				case '/upload/s3-room':
					return await uploadS3RoomData(request, env);

				default:
					return await webSocketDurableStub.fetch(request);
			}
		}

		if (url.pathname === '/dashboard') {
			const response = await webSocketDurableStub.fetch(
				'https://state-handler.internal/internal/dashboard-data'
			);

			const socketMapsJson = await response.json();

			return new Response(JSON.stringify({
				status: 200,
				trackers: socketMapsJson.trackerCount,
				hamburburs: socketMapsJson.hamburburs.map(u => u.username)
			}), {
				status: 200,
				headers: {
					'Content-Type': 'application/json'
				}
			});
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

		if (url.pathname === '/manage') {
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
