export async function uploadS3RoomData(request, env) {
	const returnData = performRequestChecks(request, env);
	if (returnData.shouldReturn) {
		return returnData.response;
	}

	const roomData = await request.json();
	let hamburburData = await env.DATA_KV.get('data.json', { type: 'json' });

	for (const playerData of roomData.Players) {
		let actualPlayerName = hamburburData.knownPeople[playerData.PlayerId];
		const cosmeticKeys = Object.keys(hamburburData.specialCosmetics);
		let knownCosmetics = cosmeticKeys.filter(key => playerData.ConcatString.includes(key)).map(key => hamburburData.specialCosmetics[key]).join(', ');

		if (!actualPlayerName && !knownCosmetics) {
			continue;
		}

		await handleTrackedPlayer({
			isUserKnown: actualPlayerName,
			username: actualPlayerName,
			hasSpecialCosmetic: knownCosmetics,
			specialCosmetic: knownCosmetics,
			roomCode: roomData.RoomName,
			playersInRoom: roomData.Players.length,
			inGameName: playerData.Name,
			gameModeString: roomData.GameMode,
			userId: playerData.PlayerId
		}, env);
	}
}

export async function uploadTrackingData(request, env) {
	const returnData = performRequestChecks(request, env);
	if (returnData.shouldReturn) {
		return returnData.response;
	}

	await handleTrackedPlayer(await request.json(), env);
}

function performRequestChecks(request, env) {
	if (request.method !== 'POST') {
		return {
			shouldReturn: true, response: new Response(JSON.stringify({
				status: 405, error: 'MethodNotAllowed', message: 'You can only send POST requests to this URL'
			}), {
				status: 405, headers: {
					'Content-Type': 'application/json'
				}
			})
		};
	}

	let authKey = request.headers.get('auth-key');

	if (!authKey || authKey !== env.TRACKER_UPLOAD_SECRET_KEY) {
		return {
			shouldReturn: true, response: new Response(JSON.stringify({
				status: 401, error: 'Unauthorized', message: 'You are not authorized to send POST requests to this URL.'
			}), {
				headers: { 'Content-Type': 'application/json' }, status: 401
			})
		};
	}

	return {
		shouldReturn: false
	};
}

async function handleTrackedPlayer(trackingData, env) {
	const stub = env.WEBSOCKET_DURABLE.getByName('websocket');
	await stub.fetch('https://state-handler.internal/internal/sockets-tracking', {
		method: 'POST', headers: {
			'Content-Type': 'application/json', 'auth-key': env.TRACKER_UPLOAD_SECRET_KEY
		}, body: JSON.stringify(trackingData)
	});

	const baseEmbed = {
		title: `Tracked 🎯 ${trackingData.isUserKnown ? trackingData.username : 'Unknown Player'}` + (trackingData.hasSpecialCosmetic ? ` ✨ (${trackingData.specialCosmetic})` : ''),
		description: 'Player tracked in-game.',
		color: trackingData.isUserKnown ? 0x2B265B : 0x0A0633,
		fields: [{
			name: '🏷 Room Code', value: `\`${trackingData.roomCode ?? 'N/A'}\``, inline: true
		}, {
			name: '👥 Players', value: `\`${trackingData.playersInRoom ?? 'N/A'}\``, inline: true
		}, {
			name: '🎮 Game Mode', value: `\`${trackingData.gameModeString ?? 'N/A'}\``, inline: true
		}, {
			name: '🧍 In-Game Name', value: `\`${trackingData.inGameName ?? 'N/A'}\``, inline: true
		}, {
			name: '🆔 User ID', value: `\`${trackingData.userId ?? 'N/A'}\``, inline: false
		}],
		footer: {
			text: 'hamburbur™ Tracker  •  Live Update'
		},
		timestamp: new Date().toISOString()
	};

	const sendWebhook = async (url, json) => {
		const res = await fetch(url, {
			method: 'POST', headers: {
				'Content-Type': 'application/json'
			}, body: JSON.stringify(json)
		});

		const text = await res.text();
		console.log('Webhook status:', res.status, text);
	};

	await sendWebhook(env.GC_WEBHOOK, { embeds: [baseEmbed] });
	await sendWebhook(env.HDM_WEBHOOK, { content: '<@&1469410214876020786>', embeds: [baseEmbed] });
	await sendWebhook(env.MB_WEBHOOK, {
		username: 'hamburbur™ Tracker',
		avatar_url: 'https://files.hamburbur.org/HamburburSuperAdmin.png',
		content: '<@&1474125765758029825>',
		embeds: [baseEmbed]
	});
}
