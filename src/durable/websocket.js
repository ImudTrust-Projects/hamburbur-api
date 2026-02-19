import { DurableObject } from 'cloudflare:workers';

export class WebSocketDurable extends DurableObject {
	hamburburSockets = new Map();
	trackerSockets = new Set();
	env;

	constructor(ctx, env) {
		super(ctx, env);
		this.env = env;
	}

	broadcastUsers() {
		const users = Array.from(this.hamburburSockets.values()).map(
			/** @returns {{ userId: string, username: string }} */
			user => ({
				userId: user.userId,
				username: user.username
			})
		);

		const payload = JSON.stringify({ type: 'broadcastUsers', users: users });

		for (const socket of this.hamburburSockets.keys()) {
			try {
				socket.send(payload);
			} catch (e) {
				console.error(e);
				this.hamburburSockets.delete(socket);
			}
		}
	}

	async fetch(request) {
		const url = new URL(request.url);

		if (url.pathname === '/internal/dashboard-data') {
			return new Response(JSON.stringify({
				hamburburs: Array.from(this.hamburburSockets.values()),
				trackerCount: this.trackerSockets.size
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (url.pathname === '/internal/sockets-tracking') {
			const suppliedAuthKey = request.headers.get('auth-key');

			if (suppliedAuthKey && suppliedAuthKey === this.env.SECRET_KEY) {
				const trackingData = await request.json();
				const hamburburSpecificData = {
					type: 'telemetryUploadSpecial',
					trackingData: trackingData
				};

				for (const socket of this.hamburburSockets.keys()) {
					try {
						socket.send(JSON.stringify(hamburburSpecificData));
					} catch (e) {
						console.error(e);
						this.hamburburSockets.delete(socket);
					}
				}

				for (const socket of this.trackerSockets) {
					try {
						socket.send(JSON.stringify(trackingData));
					} catch (e) {
						console.error(e);
						this.hamburburSockets.delete(socket);
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

		if (url.pathname === '/websocket') {
			const key = url.searchParams.get('key');

			if (!key || key !== this.env.SECRET_KEY) {
				return new Response(JSON.stringify({
					status: 401,
					error: 'Unauthorized',
					message: 'To interact with any of the non static hamburbur APIs you must supply the secret key.'
				}), {
					headers: { 'Content-Type': 'application/json' },
					status: 401
				});
			}

			const userId = url.searchParams.get('userId');
			const username = url.searchParams.get('username');

			if (!userId || !username) {
				return new Response(JSON.stringify({
					status: 400,
					error: 'InvalidParameters',
					message: 'Expected a \'userId\' and a \'username\' parameter, didn\'t get the expected parameter'
				}), {
					headers: { 'Content-Type': 'application/json' },
					status: 400
				});
			}

			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			server.accept();
			this.hamburburSockets.set(server, { userId: userId, username: username });

			server.addEventListener('message', async event => {
				const data = JSON.parse(event.data);
				const type = data.type;

				switch (type) {
					case 'ping':
						event.target.send(JSON.stringify({ type: 'pong', timeStamp: Date.now() }));
						break;

					case 'telemetryUpload':
						const telemetryPayload = {
							embeds: [
								{
									title: `Code uploaded to telemetry by ${data.username}`,
									fields: [
										{ name: 'Code', value: data.roomCode || 'N/A' },
										{ name: 'Players In Code', value: data.playersInCode || 'N/A' },
										{ name: 'GameMode String', value: data.gameModeString || 'N/A' }
									]
								}
							]
						};

						await fetch(this.env.GC_DEV_WEBHOOK, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify(telemetryPayload)
						});
						break;

					case 'broadcastData':
						for (const socket of this.hamburburSockets.keys()) {
							try {
								socket.send(JSON.stringify(data));
							} catch (e) {
								console.error(e);
								this.hamburburSockets.delete(socket);
							}
						}
						break;
				}
			});

			server.addEventListener('close', event => {
				this.hamburburSockets.delete(event.target);
				this.broadcastUsers();
			});

			this.broadcastUsers();

			return new Response(null, {
				status: 101,
				webSocket: client
			});
		}

		if (url.pathname === '/tracker') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			server.accept();
			this.trackerSockets.add(server);

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
}
