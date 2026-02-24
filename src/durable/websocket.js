import { DurableObject } from 'cloudflare:workers';

export class WebSocketDurable extends DurableObject {
	trackerSockets = new Set();

	ctx;
	env;

	constructor(ctx, env) {
		super(ctx, env);
		this.ctx = ctx;
		this.env = env;
	}

	async fetch(request) {
		const url = new URL(request.url);

		if (url.pathname === '/internal/dashboard-data') {
			return new Response(JSON.stringify({
				trackerCount: this.trackerSockets.size
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (url.pathname === '/internal/sockets-tracking') {
			const suppliedAuthKey = request.headers.get('auth-key');

			if (suppliedAuthKey && suppliedAuthKey === this.env.TRACKER_UPLOAD_SECRET_KEY) {
				const trackingData = await request.json();

				for (const socket of this.trackerSockets) {
					try {
						socket.send(JSON.stringify(trackingData));
					} catch (e) {
						console.error(e);
						this.trackerSockets.delete(socket);
					}
				}
			}
		}

		const upgradeHeader = request.headers.get('Upgrade');

		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return new Response(JSON.stringify({
				status: 426,
				error: 'InvalidHeaders',
				message: 'Expected the Upgrade header to be websocket'
			}), {
				headers: { 'Content-Type': 'application/json' },
				status: 426
			});
		}

		if (url.pathname === '/tracker') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			server.accept();
			this.trackerSockets.add(server);
			await this.checkForTrackerPeak();

			server.addEventListener('message', event => {
				console.log('lolz someone tried pushing data');
			});

			server.addEventListener('close', event => {
				this.trackerSockets.delete(server);
			});

			return new Response(null, {
				status: 101,
				webSocket: client
			});
		}
	}

	async checkForTrackerPeak() {
		const lastPeak = await this.ctx.storage.get('trackerPeak');
		const trackers = this.trackerSockets.size + this.hamburburSockets.size;
		if (!lastPeak || lastPeak < trackers) {
			await this.ctx.storage.put('trackerPeak', trackers);
			await fetch(this.env.USER_COUNT_WEBHOOK, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					content: `new peak of ${trackers} people connected to the tracker socket`
				})
			});
		}
	}
}
