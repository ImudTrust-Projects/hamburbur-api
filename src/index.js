export { WebSocketDurable } from './durable/websocket';
export { TrackerDurable } from './durable/tracker';

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

		if (url.pathname === '/tracker') {
			const stub = env.TRACKER_DURABLE.getByName('tracker');
			return stub.fetch(request);
		}

		return new Response('hiiii');
	}
};
