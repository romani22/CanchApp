export interface IStorageRepository {
	/**
	 * Uploads a file to storage.
	 * @param path Storage path (e.g. "userId/avatar.jpg")
	 * @param data File data as ArrayBuffer
	 * @param contentType MIME type
	 * @returns Public URL with cache-buster timestamp
	 */
	upload(path: string, data: ArrayBuffer, contentType: string): Promise<string>

	/** Deletes files at the given storage paths */
	delete(paths: string[]): Promise<void>

	/** Returns the public URL for a stored file */
	getPublicUrl(path: string): string
}
