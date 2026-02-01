import { DurableObject } from 'cloudflare:workers';

export class TrackerDurable extends DurableObject {
	sockets = [];
	env;

	constructor(ctx, env) {
		super(ctx, env);
		this.env = env;
	}

	async uploadTrackingData(request) {
		const url = new URL(request.url);

		if (url.pathname === '/internal/upload-event') {
			const authKey = request.headers.get('Auth-Key');

			if (!authKey || authKey !== this.env.SECRET_KEY) {
				return new Response(JSON.stringify({ 'Unauthorized': 'To interact with any of the non static hamburbur APIs you must supply the secret key' }), {
					headers: { 'Content-Type': 'application/json' },
					status: 401
				});
			}

			const trackingData = await request.json();

			for (const socket of this.sockets) {
				try {
					socket.send(JSON.stringify(trackingData));
				} catch (e) {
					console.error(e);
					this.sockets.splice(this.sockets.indexOf(socket), 1);
				}
			}
		}
	}

	fetch(request) {
		const upgradeHeader = request.headers.get('Upgrade');

		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return new Response(JSON.stringify({
				error: 'InvalidHeaders',
				message: 'Expected the Upgrade header to be websocket'
			}), {
				headers: { 'Content-Type': 'application/json' },
				status: 426
			});
		}

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		server.accept();
		this.sockets.push(server);

		server.addEventListener('close', event => {
			this.sockets.splice(this.sockets.indexOf(server), 1);
		});

		return new Response(null, {
			status: 101,
			webSocket: client
		});
	}
}
