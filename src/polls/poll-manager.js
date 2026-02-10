import pollData from './poll.json'

export async function handlePollRequest(request, env) {
	const url = new URL(request.url);

	const ip = request.headers.get('CF-Connecting-IP');

	if (ip) {
		const encoder = new TextEncoder();
		const data = encoder.encode(ip);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = new Uint8Array(hashBuffer);
		const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
		const result = await env.poll_database.prepare("SELECT 1 FROM UserPolls WHERE HashedIP = ? LIMIT 1").bind(hashHex).first();
		const exists = result !== null;

		await env.poll_database.prepare('INSERT OR IGNORE INTO UserPolls (HashedIP, PollId) VALUES (?, ?)').bind(hashHex, currentPoll).run();

		if (exists) {
			return new Response(JSON.stringify({
				'No more visting': true
			}), {
				headers: { 'Content-Type': 'application/json' },
				status: 200
			})
		}
	}
	else {
		return new Response(JSON.stringify({
			'No more asdf': true
		}), {
			headers: { 'Content-Type': 'application/json' },
			status: 200
		})
	}

	/*if (url.pathname === '/poll/upload' && request.method === 'POST') {
	let body;

	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({
			status: 400,
			error: 'InvalidJSON',
			message: 'Request body must be valid JSON.'
		}), {
			headers: { 'Content-Type': 'application/json' },
			status: 400
		});
	}

	const answeredA = body.answeredA;

	if (typeof answeredA !== 'boolean') {
		return new Response(JSON.stringify({
			status: 400,
			error: 'InvalidParameters',
			message: 'answeredA must be a boolean.'
		}), {
			headers: { 'Content-Type': 'application/json' },
			status: 400
		});
	}

	const currentPoll = pollData.currentPoll;

	const ip = request.headers.get('x-forwarded-for');

	if (ip) {
		const encoder = new TextEncoder();
		const data = encoder.encode(ip);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = new Uint8Array(hashBuffer);
		const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

		await env.poll_database.prepare('INSERT OR IGNORE INTO AnsweredPolls (HashedIP, PollId) VALUES (?, ?)').bind(hashHex, currentPoll).run();
	}
}*/

	return new Response(JSON.stringify(pollData), {
		headers: { 'Content-Type': 'application/json' },
		status: 200
	})
}
