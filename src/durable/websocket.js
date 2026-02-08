import { DurableObject } from 'cloudflare:workers';

export class WebSocketDurable extends DurableObject {
	/** @typedef { Map<WebSocket, { userId: string, username: string }> }*/
	hamburburSockets = new Map();
	lastTrackingData;
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

	tracker(request) {
		const payload = this.lastTrackingData ?? { error: 'No tracking data yet' };

		return new Response(JSON.stringify(payload), {
			headers: { 'Content-Type': 'application/json' },
			status: 200
		});
	}

	dashboard(request) {
		return new Response(JSON.stringify({
			'hamburbur users': Array.from(this.hamburburSockets.values()).map(
				/** @returns {{ Username: string }} */
				user => ({
					username: user.username
				})
			)
		}), {
			headers: { 'Content-Type': 'application/json' },
			status: 200
		});
	}

	async fetch(request) {
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

		const url = new URL(request.url);

		if (url.pathname === '/websocket') {

			const key = url.searchParams.get('key');

			if (!key || key !== this.env.SECRET_KEY) {
				return new Response(JSON.stringify({ 'Unauthorized': 'To interact with any of the non static hamburbur APIs you must supply the secret key' }), {
					headers: { 'Content-Type': 'application/json' },
					status: 401
				});
			}

			const userId = url.searchParams.get('userId');
			const username = url.searchParams.get('username');

			if (!userId || !username) {
				return new Response(JSON.stringify({ 'Invalid parameter passed': 'Expected a \'userId\' and a \'username\' parameter, didn\'t get the expected parameter' }), {
					headers: { 'Content-Type': 'application/json' },
					status: 404
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
						const uploadData = data.roomData;
						const telemetryPayload = {
							embeds: [
								{
									title: `Code uploaded to telemetry by ${uploadData.Username}`,
									fields: [
										{ name: 'Code', value: uploadData.RoomCode },
										{ name: 'Players In Code', value: `${uploadData.PlayersInRoom}/10` },
										{ name: 'GameMode String', value: uploadData.GameModeString }
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

					case 'telemetryUploadSpecial':
						const trackingData = data.trackingData;
						this.lastTrackingData = trackingData;
						for (const socket of this.hamburburSockets.keys()) {
							try {
								socket.send(JSON.stringify(data));
							} catch (e) {
								console.error(e);
								this.hamburburSockets.delete(socket);
							}
						}

						const embedPayload = {
							embeds: [
								{
									title: `Found ${trackingData.IsUserKnown ? trackingData.Username : 'someone'}${trackingData.HasSpecialCosmetic ? ` with ${trackingData.SpecialCosmetic}` : ''}!`,
									fields: [
										{ name: 'Room Code', value: trackingData.RoomCode || 'N/A' },
										{ name: 'Players In Code', value: `${trackingData.PlayersInRoom}/10` },
										{ name: 'In Game Name', value: trackingData.InGameName || 'Unknown' },
										{ name: 'GameMode String', value: trackingData.GameModeString || 'Unknown' }
									],
									color: 0x2B265B
								}
							]
						};

						const embedPayloadHDM = {
							content: '<@&1469410214876020786>',
							embeds: [
								{
									title: `Found ${trackingData.IsUserKnown ? trackingData.Username : 'someone'}${trackingData.HasSpecialCosmetic ? ` with ${trackingData.SpecialCosmetic}` : ''}!`,
									fields: [
										{ name: 'Room Code', value: trackingData.RoomCode || 'N/A' },
										{ name: 'Players In Code', value: `${trackingData.PlayersInRoom}/10` },
										{ name: 'In Game Name', value: trackingData.InGameName || 'Unknown' },
										{ name: 'GameMode String', value: trackingData.GameModeString || 'Unknown' }
									],
									color: 0x2B265B
								}
							]
						};

						const sendWebhook = async (url) => {
							const res = await fetch(url, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json'
								},
								body: JSON.stringify(embedPayload)
							});

							const text = await res.text();
							console.log('Webhook status:', res.status, text);
						};

						await sendWebhook(this.env.GC_WEBHOOK);
						await sendWebhook(this.env.AMP_WEBHOOK);
						await sendWebhook(this.env.MB_WEBHOOK);

						await fetch(this.env.HDM_WEBHOOK, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify(embedPayloadHDM)
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

					case 'broadcastDataNonPhotonDependent':
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

		if (url.pathname === '/telemetry') {
			const key = url.searchParams.get('key');

			if (!key || key !== this.env.TELEMETRY_WRITE_SECRET_KEY) {
				return new Response(JSON.stringify({ 'error': 'Unauthorized, you must supply the secret key to write telemetry data' }), {
					headers: { 'Content-Type': 'application/json' },
					status: 401
				});
			}

			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			server.accept();

			server.addEventListener('message', async event => {
				const data = JSON.parse(event.data);
				const trackingData = data.trackingData;
				this.lastTrackingData = trackingData;

				for (const socket of this.hamburburSockets.keys()) {
					try {
						socket.send(JSON.stringify(data));
					} catch (e) {
						console.error(e);
						this.hamburburSockets.delete(socket);
					}
				}

				const embedPayload = {
					embeds: [
						{
							title: `Found ${trackingData.IsUserKnown ? trackingData.Username : 'someone'}${trackingData.HasSpecialCosmetic ? ` with ${trackingData.SpecialCosmetic}` : ''}!`,
							fields: [
								{ name: 'Room Code', value: trackingData.RoomCode || 'N/A' },
								{ name: 'Players In Code', value: `${trackingData.PlayersInRoom}/10` },
								{ name: 'In Game Name', value: trackingData.InGameName || 'Unknown' },
								{ name: 'GameMode String', value: trackingData.GameModeString || 'Unknown' }
							],
							color: 0x2B265B
						}
					]
				};

				const embedPayloadHDM = {
					content: '<@&1469410214876020786>',
					embeds: [
						{
							title: `Found ${trackingData.IsUserKnown ? trackingData.Username : 'someone'}${trackingData.HasSpecialCosmetic ? ` with ${trackingData.SpecialCosmetic}` : ''}!`,
							fields: [
								{ name: 'Room Code', value: trackingData.RoomCode || 'N/A' },
								{ name: 'Players In Code', value: `${trackingData.PlayersInRoom}/10` },
								{ name: 'In Game Name', value: trackingData.InGameName || 'Unknown' },
								{ name: 'GameMode String', value: trackingData.GameModeString || 'Unknown' }
							],
							color: 0x2B265B
						}
					]
				};

				const sendWebhook = async (url) => {
					const res = await fetch(url, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify(embedPayload)
					});

					const text = await res.text();
					console.log('Webhook status:', res.status, text);
				};

				await sendWebhook(this.env.GC_WEBHOOK);
				await sendWebhook(this.env.AMP_WEBHOOK);
				await sendWebhook(this.env.MB_WEBHOOK);

				await fetch(this.env.HDM_WEBHOOK, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(embedPayloadHDM)
				});
			});

			return new Response(null, {
				status: 101,
				webSocket: client
			});
		}
	}
}
