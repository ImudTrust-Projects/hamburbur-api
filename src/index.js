export { WebSocketDurable } from './durable/websocket';
import data from './data';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (url.pathname === '/websocket') {
			const stub = env.WEBSOCKET_DURABLE.getByName('websocket');
			return stub.fetch(request);
		}

		if (url.pathname === '/dashboard') {
			const stub = env.WEBSOCKET_DURABLE.getByName('websocket');
			return stub.handleDashboard(request);
		}

		if (url.pathname === '/data') {
			return new Response(JSON.stringify(data), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response('not done yet gangalang');
	}
};
