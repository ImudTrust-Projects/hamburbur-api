export async function handleDataManagement(request, env) {
	try {
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || authHeader !== env.SECRET_KEY) {
			return new Response(JSON.stringify({ 'Unauthorized': 'To interact with any of the non static hamburbur APIs you must supply the secret key' }), {
				headers: { 'Content-Type': 'application/json' },
				status: 401
			});
		}

		const body = await request.json();
		const { action, ...params } = body;

		if (!action) {
			return new Response(JSON.stringify({
				error: 'MissingRequiredField',
				message: 'Missing the required field: action'
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		let currentData = await env.DATA_KV.get('data.json', { type: 'json' });
		if (!currentData) currentData = data;

		let result;
		switch (action) {
			case 'add_admin':
				result = addAdmin(currentData, params);
				break;
			case 'remove_admin':
				result = removeAdmin(currentData, params);
				break;
			case 'add_superadmin':
				result = addSuperAdmin(currentData, params);
				break;
			case 'remove_superadmin':
				result = removeSuperAdmin(currentData, params);
				break;
			case 'change_hamburbur_status':
				result = changeHamburburStatus(currentData, params);
				break;
			case 'add_console_status':
				result = addConsoleStatus(currentData, params);
				break;
			case 'edit_console_status':
				result = editConsoleStatus(currentData, params);
				break;
			case 'remove_console_status':
				result = removeConsoleStatus(currentData, params);
				break;
			case 'add_known_cheat':
				result = addKnownCheat(currentData, params);
				break;
			case 'remove_known_cheat':
				result = removeKnownCheat(currentData, params);
				break;
			case 'add_known_mod':
				result = addKnownMod(currentData, params);
				break;
			case 'remove_known_mod':
				result = removeKnownMod(currentData, params);
				break;
			case 'add_known_person':
				result = addKnownPerson(currentData, params);
				break;
			case 'remove_known_person':
				result = removeKnownPerson(currentData, params);
				break;
			case 'update_message_of_the_day':
				result = updateMotd(currentData, params);
				break;
			case 'update_version':
				result = updateVersion(currentData, params);
				break;
			case 'add_mod_version_info':
				result = addModVersionInfo(currentData, params);
				break;
			case 'edit_mod_version_info':
				result = editModVersionInfo(currentData, params);
				break;
			case 'remove_mod_version_info':
				result = removeModVersionInfo(currentData, params);
				break;
			case 'add_mod_specific_admin':
				result = addModSpecificAdmin(currentData, params);
				break; // hi
			case 'remove_mod_specific_admin':
				result = removeModSpecificAdmin(currentData, params);
				break;
			case 'add_special_cosmetic':
				result = addSpecialCosmetic(currentData, params);
				break;
			case 'remove_special_cosmetic':
				result = removeSpecialCosmetic(currentData, params);
				break;
			case 'add_clean_up_forest_object_name':
				result = addCleanUpForestObjectName(currentData, params);
				break;
			case 'clear_clean_up_forest_object_names':
				result = clearCleanUpForestObjectNames(currentData);
				break;
			default:
				return new Response(JSON.stringify({
					success: false,
					error: `Unknown action: ${action}`
				}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		if (result.success) {
			const updatedData = JSON.stringify(currentData, null, 2);
			await env.DATA_KV.put('data.json', updatedData);
			return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
		}

	} catch (error) {
		return new Response(JSON.stringify({
			success: false,
			error: error.message
		}), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
}

function addAdmin(currentData, { userId, name }) {
	if (!userId || !name) return { success: false, error: 'Missing userId or name' };
	if (currentData.admins.some(a => a.userId === userId)) return { success: false, error: 'Admin already exists' };
	currentData.admins.push({ name, userId });
	return { success: true, message: `Added admin: ${name} (${userId})`, data: currentData };
}

function removeAdmin(currentData, { userId, name }) {
	if (!userId && !name) return { success: false, error: 'Must provide either userId or name' };
	const initialLength = currentData.admins.length;
	currentData.admins = currentData.admins.filter(a => (userId ? a.userId !== userId : a.name !== name));
	if (currentData.admins.length === initialLength) return { success: false, error: 'Admin not found' };
	return { success: true, message: `Removed admin: ${name || userId}`, data: currentData };
}

function addSuperAdmin(currentData, { name }) {
	if (!name) return { success: false, error: 'Missing name' };
	if (currentData.superAdmins.includes(name)) return { success: false, error: 'SuperAdmin already exists' };
	currentData.superAdmins.push(name);
	return { success: true, message: `Added superAdmin: ${name}`, data: currentData };
}

function removeSuperAdmin(currentData, { name }) {
	if (!name) return { success: false, error: 'Missing name' };
	const initialLength = currentData.superAdmins.length;
	currentData.superAdmins = currentData.superAdmins.filter(a => a !== name);
	if (currentData.superAdmins.length === initialLength) return { success: false, error: 'SuperAdmin not found' };
	return { success: true, message: `Removed superAdmin: ${name}`, data: currentData };
}

function changeHamburburStatus(currentData, { status }) {
	if (!status) return { success: false, error: 'Missing status' };
	currentData.hamburburStatus = status;
	return { success: true, message: `Changed hamburbur status to: ${status}`, data: currentData };
}

function addConsoleStatus(currentData, { consoleName, status }) {
	if (!consoleName || !status) return { success: false, error: 'Missing consoleName or status' };
	if (currentData.consoleStatuses.some(cs => cs.consoleName === consoleName)) return {
		success: false,
		error: 'Console status exists. Use edit_console_status.'
	};
	currentData.consoleStatuses.push({ consoleName, status });
	return { success: true, message: `Added console status: ${consoleName} - ${status}`, data: currentData };
}

function editConsoleStatus(currentData, { consoleName, status }) {
	if (!consoleName || !status) return { success: false, error: 'Missing consoleName or status' };
	const cs = currentData.consoleStatuses.find(cs => cs.consoleName === consoleName);
	if (!cs) return { success: false, error: 'Console status not found' };
	cs.status = status;
	return { success: true, message: `Updated console status: ${consoleName} - ${status}`, data: currentData };
}

function removeConsoleStatus(currentData, { consoleName }) {
	if (!consoleName) return { success: false, error: 'Missing consoleName' };
	const initialLength = currentData.consoleStatuses.length;
	currentData.consoleStatuses = currentData.consoleStatuses.filter(cs => cs.consoleName !== consoleName);
	if (currentData.consoleStatuses.length === initialLength) return {
		success: false,
		error: 'Console status not found'
	};
	return { success: true, message: `Removed console status: ${consoleName}`, data: currentData };
}

function addKnownCheat(currentData, { key, value }) {
	if (!key || !value) return { success: false, error: 'Missing key or value' };
	if (currentData.knownCheats[key]) return { success: false, error: 'Cheat already exists' };
	currentData.knownCheats[key] = value;
	return { success: true, message: `Added known cheat: ${key} - ${value}`, data: currentData };
}

function removeKnownCheat(currentData, { key }) {
	if (!key) return { success: false, error: 'Missing key' };
	if (!currentData.knownCheats[key]) return { success: false, error: 'Cheat not found' };
	delete currentData.knownCheats[key];
	return { success: true, message: `Removed known cheat: ${key}`, data: currentData };
}

function addKnownMod(currentData, { key, value }) {
	if (!key || !value) return { success: false, error: 'Missing key or value' };
	if (currentData.knownMods[key]) return { success: false, error: 'Mod already exists' };
	currentData.knownMods[key] = value;
	return { success: true, message: `Added known mod: ${key} - ${value}`, data: currentData };
}

function removeKnownMod(currentData, { key }) {
	if (!key) return { success: false, error: 'Missing key' };
	if (!currentData.knownMods[key]) return { success: false, error: 'Mod not found' };
	delete currentData.knownMods[key];
	return { success: true, message: `Removed known mod: ${key}`, data: currentData };
}

function addKnownPerson(currentData, { userId, name }) {
	if (!userId || !name) return { success: false, error: 'Missing userId or name' };
	if (currentData.knownPeople[userId]) return { success: false, error: 'Person already exists' };
	currentData.knownPeople[userId] = name;
	return { success: true, message: `Added known person: ${userId} - ${name}`, data: currentData };
}

function removeKnownPerson(currentData, { userId }) {
	if (!userId) return { success: false, error: 'Missing userId' };
	if (!currentData.knownPeople[userId]) return { success: false, error: 'Person not found' };
	delete currentData.knownPeople[userId];
	return { success: true, message: `Removed known person: ${userId}`, data: currentData };
}

function updateMotd(currentData, { text }) {
	if (!text) return { success: false, error: 'Missing text' };
	currentData.messageOfTheDayText = text;
	return { success: true, message: 'Updated message of the day', data: currentData };
}

function updateVersion(currentData, { latest, minimum }) {
	if (!latest && !minimum) return { success: false, error: 'Must provide either latest or minimum version' };
	if (latest) currentData.latestMenuVersion = latest;
	if (minimum) currentData.minimumMenuVersion = minimum;
	return { success: true, message: 'Updated version info', data: currentData };
}

function addModVersionInfo(currentData, { modName, latestVersion, minimumVersion, notLatestMessage, outdatedMessage }) {
	if (!modName || !latestVersion || !minimumVersion || !notLatestMessage || !outdatedMessage) return {
		success: false,
		error: 'Missing necessary data'
	};
	if (currentData.modVersionInfo.some(mvi => mvi.modName === modName)) return {
		success: false,
		error: 'Version info already exists'
	};
	currentData.modVersionInfo.push({ modName, latestVersion, minimumVersion, notLatestMessage, outdatedMessage });
	return { success: true, message: 'Updated mod version info', data: currentData };
}

function editModVersionInfo(currentData, {
	modName,
	latestVersion,
	minimumVersion,
	notLatestMessage,
	outdatedMessage
}) {
	if (!modName || !latestVersion || !minimumVersion || !notLatestMessage || !outdatedMessage) return {
		success: false,
		error: 'Missing necessary data'
	};
	const mvi = currentData.modVersionInfo.find(mvi => mvi.modName === modName);
	if (!mvi) return { success: false, error: 'Mod version info not found' };
	mvi.latestVersion = latestVersion;
	mvi.minimumVersion = minimumVersion;
	mvi.notLatestMessage = notLatestMessage;
	mvi.outdatedMessage = outdatedMessage;
	return { success: true, message: 'Updated mod version info', data: currentData };
}

function removeModVersionInfo(currentData, { modName }) {
	if (!modName) return { success: false, error: 'Missing necessary data' };
	const initialLength = currentData.modVersionInfo.length;
	currentData.modVersionInfo = currentData.modVersionInfo.filter(mvi => mvi.modName !== modName);
	if (currentData.modVersionInfo.length === initialLength) return {
		success: false,
		error: 'Mod version info not found'
	};
	return { success: true, message: `Removed mod version info: ${modName}`, data: currentData };
}

function addModSpecificAdmin(currentData, { consoleName, userId, name, superAdmin }) {
	if (!consoleName || !userId || !name || superAdmin === undefined) {
		return { success: false, error: 'Missing necessary data' };
	}

	let msa = currentData.modSpecificAdmins.find(msa => msa.consoleName === consoleName);

	if (!msa) {
		msa = {
			consoleName,
			admins: []
		};
		currentData.modSpecificAdmins.push(msa);
	}

	msa.admins.push({ name, userId, superAdmin });

	return { success: true, message: 'Mod specific admin added to the user', data: currentData };
}

function removeModSpecificAdmin(currentData, { consoleName, userId }) {
	if (!consoleName || !userId) return { success: false, error: 'Missing necessary data' };
	if (!currentData.modSpecificAdmins.some(msa => msa.consoleName === consoleName)) return {
		success: false,
		error: 'No mod specific admins found'
	};
	const msa = currentData.modSpecificAdmins.find(msa => msa.consoleName === consoleName);
	const initialLength = msa.admins.length;
	msa.admins = msa.admins.filter(a => a.userId !== userId);
	if (msa.admins.length === initialLength) return { success: false, error: 'Couldn\'t find specified user' };
	if (msa.admins.length === 0) currentData.modSpecificAdmins = currentData.modSpecificAdmins.filter(msa => msa.consoleName !== consoleName);
	return { success: true, message: 'Mod specific admin removed from the user', data: currentData };
}

function addSpecialCosmetic(currentData, { cosmeticId, nonDetailedName, detailedName }) {
	if (!cosmeticId || !nonDetailedName || !detailedName) {
		return { success: false, error: 'Missing necessary data' };
	}

	if (
		Object.prototype.hasOwnProperty.call(currentData.specialCosmetics, cosmeticId) ||
		Object.prototype.hasOwnProperty.call(currentData.specialCosmeticsDetailed, cosmeticId)
	) {
		return {
			success: false,
			error: 'Special cosmetic already there'
		};
	}

	currentData.specialCosmetics[cosmeticId] = nonDetailedName;
	currentData.specialCosmeticsDetailed[cosmeticId] = detailedName;

	return { success: true, message: 'Special cosmetic added', data: currentData };
}

function removeSpecialCosmetic(currentData, { cosmeticId }) {
	if (!cosmeticId) {
		return { success: false, error: 'Missing necessary data' };
	}

	const existsInBasic = Object.prototype.hasOwnProperty.call(currentData.specialCosmetics, cosmeticId);
	const existsInDetailed = Object.prototype.hasOwnProperty.call(currentData.specialCosmeticsDetailed, cosmeticId);

	if (!existsInBasic && !existsInDetailed) {
		return {
			success: false,
			error: 'Special cosmetic not found'
		};
	}

	delete currentData.specialCosmetics[cosmeticId];
	delete currentData.specialCosmeticsDetailed[cosmeticId];

	return { success: true, message: 'Special cosmetic removed', data: currentData };
}

function addCleanUpForestObjectName(currentData, { objectName }) {
	if (!objectName) return { success: false, error: 'Missing necessary data' };
	if (!currentData.cleanUpForestObjectNames.some(o => o === objectName)) currentData.cleanUpForestObjectNames.push(objectName);
	return { success: true, message: 'Added object name', data: currentData };
}

function clearCleanUpForestObjectNames(currentData) {
	currentData.cleanUpForestObjectNames = [];
	return { success: true, message: 'Cleared object names', data: currentData };
}
