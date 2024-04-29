import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";

import apm from "$lib/server/apmSingleton";
const spanTypeName = "lock_ts";

/**
 * Returns the lock id if the lock was acquired, false otherwise
 */
export async function acquireLock(key: string): Promise<ObjectId | false> {
	const acquireLockSpan = apm.startSpan("Acquire Lock", spanTypeName);
	try {
		const id = new ObjectId();

		const insert = await collections.semaphores.insertOne({
			_id: id,
			key,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		acquireLockSpan?.setLabel("lock_id", id.toString());
		acquireLockSpan?.end();

		return insert.acknowledged ? id : false; // true if the document was inserted
	} catch (e) {
		// unique index violation, so there must already be a lock
		acquireLockSpan?.end();
		return false;
	}
}

export async function releaseLock(key: string, lockId: ObjectId) {
	const releaseLockSpan = apm.startSpan("Release Lock", spanTypeName);
	releaseLockSpan?.setLabel("lock_id", lockId.toString());
	await collections.semaphores.deleteOne({
		_id: lockId,
		key,
	});
	releaseLockSpan?.end();
}

export async function isDBLocked(key: string): Promise<boolean> {
	const res = await collections.semaphores.countDocuments({
		key,
	});
	return res > 0;
}

export async function refreshLock(key: string, lockId: ObjectId): Promise<boolean> {
	const result = await collections.semaphores.updateOne(
		{
			_id: lockId,
			key,
		},
		{
			$set: {
				updatedAt: new Date(),
			},
		}
	);

	return result.matchedCount > 0;
}
