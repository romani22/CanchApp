import { repositories } from '@/repositories'
import { File } from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'

export const storageService = {
	/**
	 * Abre el picker de imágenes y sube la foto seleccionada al bucket "avatars".
	 * Devuelve la URL pública del avatar subido, o null si el usuario cancela.
	 */
	async pickAndUploadAvatar(userId: string): Promise<string | null> {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
		if (status !== 'granted') {
			throw new Error('Se necesita permiso para acceder a la galería de fotos.')
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.7,
		})

		if (result.canceled || !result.assets[0]) return null

		const asset = result.assets[0]
		const uri = asset.uri

		// Leer el archivo como base64 usando expo-file-system
		const file = new File(uri)
		const base64 = await file.base64()

		// Convertir base64 a ArrayBuffer (compatible con Supabase Storage en RN)
		const arrayBuffer = decodeBase64(base64)

		// Determinar tipo MIME y path
		const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
		const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
		const path = `${userId}/avatar.${ext}`

		return repositories.storage.upload(path, arrayBuffer, mimeType)
	},

	async deleteAvatar(userId: string): Promise<void> {
		const extensions = ['jpg', 'jpeg', 'png', 'webp']
		const paths = extensions.map((ext) => `${userId}/avatar.${ext}`)
		return repositories.storage.delete(paths)
	},
}

/**
 * Convierte un string base64 a ArrayBuffer.
 * Necesario porque React Native no tiene atob() nativo compatible.
 */
function decodeBase64(base64: string): ArrayBuffer {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
	const lookup = new Uint8Array(256)
	for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i

	const len = base64.length
	let bufferLength = Math.floor(len * 0.75)
	if (base64[len - 1] === '=') bufferLength--
	if (base64[len - 2] === '=') bufferLength--

	const buffer = new ArrayBuffer(bufferLength)
	const bytes = new Uint8Array(buffer)

	let p = 0
	for (let i = 0; i < len; i += 4) {
		const a = lookup[base64.charCodeAt(i)]
		const b = lookup[base64.charCodeAt(i + 1)]
		const c = lookup[base64.charCodeAt(i + 2)]
		const d = lookup[base64.charCodeAt(i + 3)]

		bytes[p++] = (a << 2) | (b >> 4)
		if (p < bufferLength) bytes[p++] = ((b & 15) << 4) | (c >> 2)
		if (p < bufferLength) bytes[p++] = ((c & 3) << 6) | (d & 63)
	}

	return buffer
}
