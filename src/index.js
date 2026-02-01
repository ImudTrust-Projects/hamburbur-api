export { WebSocketDurable } from './durable/websocket';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (url.pathname === "/websocket") {
			const stub = env.WEBSOCKET_DURABLE.getByName("websocket");
			return stub.fetch(request);
		}

		if (url.pathname === "/dashboard") {
			const stub = env.WEBSOCKET_DURABLE.getByName("websocket");
			return stub.handleDashboard(request);
		}

		return new Response("hiiii");
	},
};
