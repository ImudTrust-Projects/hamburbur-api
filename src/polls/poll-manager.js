export async function uploadVote(request, env) {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({
			status: 405, error: 'MethodNotAllowed', message: 'You can only send POST requests to this URL'
		}), {
			status: 405, headers: {
				'Content-Type': 'application/json'
			}
		});
	}

	const json = await request.json();

	if (!json || !json.userId || typeof json.voteForA !== "boolean") {
		return new Response(JSON.stringify({
			status: 400,
			error: "BadRequest",
			message: "Missing or invalid request body"
		}), {
			status: 400,
			headers: {
				"Content-Type": "application/json"
			}
		});
	}

	const data = await env.DATA_KV.get('data.json', { type: 'json' });
	const currentPoll  = data.pollData.name;

	const meta = await env.DATA_KV.get('poll_meta.json', { type: 'json' }) || {};
	const lastPollName = meta.activePollName;
	const lastPollOptions = meta.activePollOptions;

	if (lastPollName && lastPollName !== currentPoll) {

		const allVotes = await env.POLL_DB
			.prepare('SELECT JsonData FROM PollVotes')
			.all();

		let aVotes = 0;
		let bVotes = 0;

		for (const row of allVotes.results) {
			try {
				const parsed = JSON.parse(row.JsonData);
				const pollEntry = parsed[lastPollName];

				if (!pollEntry) continue;

				if (pollEntry.votedForA === true) aVotes++;
				else if (pollEntry.votedForA === false) bVotes++;
			} catch {}
		}

		const archive = await env.DATA_KV.get('poll_archive.json', { type: 'json' }) || {};

		archive[lastPollName] = {
			pollName: lastPollName,
			options: {
				A: lastPollOptions?.optionA || "Option A",
				B: lastPollOptions?.optionB || "Option B"
			},
			votes: {
				A: aVotes,
				B: bVotes
			},
			archivedAt: new Date().toISOString()
		};

		await env.DATA_KV.put('poll_archive.json', JSON.stringify(archive));
	}

	await env.DATA_KV.put('poll_meta.json', JSON.stringify({
		activePollName: currentPoll,
		activePollOptions: {
			optionA: data.pollData.optionA,
			optionB: data.pollData.optionB
		}
	}));

	const result = await env.POLL_DB
		.prepare("SELECT JsonData FROM PollVotes WHERE UserId = ?")
		.bind(json.userId)
		.first();

	let jsonData = {};

	try {
		jsonData = JSON.parse(result.JsonData);
	} catch {
		// ignored
	}

	if (jsonData[currentPoll]) {
		return new Response(JSON.stringify({
			status: 407,
			error: 'AlreadyVoted',
			message: 'You can not vote twice'
		}), {
			status: 407,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}

	jsonData[currentPoll] = {
		votedForA: json.voteForA
	}

	await env.POLL_DB.prepare('INSERT INTO PollVotes (UserId, JsonData) VALUES (?, ?) ON CONFLICT(UserId) DO UPDATE SET JsonData = excluded.JsonData')
		.bind(json.userId, JSON.stringify(jsonData))
		.run();

	return new Response(JSON.stringify({
		status: 200,
	}), {
		status: 200,
		headers: {
			"Content-Type": "application/json"
		}
	})
}

export async function fetchVotes(request, env) {
	const data = await env.DATA_KV.get('data.json', { type: 'json' });
	const currentPoll  = data.pollData.name;

	const result = await env.POLL_DB
		.prepare('SELECT JsonData FROM PollVotes')
		.all();

	let aVotes = 0;
	let bVotes = 0;

	for (const row of result.results) {
		try {
			const json = JSON.parse(row.JsonData);
			const pollEntry = json[currentPoll];

			if (!pollEntry) continue;

			if (pollEntry.votedForA === true) {
				aVotes++;
			} else if (pollEntry.votedForA === false) {
				bVotes++;
			}
		} catch {
			// ignored because im just built different
		}
	}

	return new Response(
		JSON.stringify({
			totalAVotes: aVotes,
			totalBVotes: bVotes
		}),
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		}
	);
}

export async function fetchArchivedVotes(request, env) {
	const archive = await env.DATA_KV.get('poll_archive.json');

	return new Response(
		archive || '{}',
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		}
	);
}
