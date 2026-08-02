/**
 * Traducción de las columnas POINT de PostgreSQL.
 *
 * Postgres devuelve POINT como el string "(x,y)" y espera ese mismo formato al
 * escribir, pero el resto de la app trabaja con { x, y }. Los tipos generados
 * declaran el objeto, así que sin normalizar al leer el tipo miente y nadie se
 * entera hasta que algo se rompe en runtime.
 *
 * Esa mentira causó tres bugs distintos, todos silenciosos:
 *   - guardar el perfil borraba zone_coordinates
 *   - editar un partido borraba venue_coordinates
 *   - el filtro de zona del Dashboard se armaba con lng/lat undefined
 *
 * La conversión vive acá, en el borde con la base, para que del repositorio
 * hacia adentro el tipo { x, y } sea siempre cierto.
 */

export type Point = { x: number; y: number }

/** "(x,y)" -> { x, y }. Tolera que ya venga como objeto. */
export function parsePoint(raw: Point | string | null | undefined): Point | null {
	if (!raw) return null
	if (typeof raw === 'object') return raw
	const match = raw.match(/\(?(-?[\d.]+),(-?[\d.]+)\)?/)
	if (!match) return null
	return { x: parseFloat(match[1]), y: parseFloat(match[2]) }
}

/** { x, y } -> "(x,y)". Cualquier cosa incompleta se guarda como NULL. */
export function serializePoint(raw: unknown): string | null {
	const coords = raw as Partial<Point> | null | undefined
	if (coords?.x == null || coords?.y == null) return null
	return `(${coords.x},${coords.y})`
}

/**
 * Devuelve una copia de la fila con las columnas POINT indicadas convertidas a
 * { x, y }. Si la fila es null la propaga tal cual.
 */
export function parseRowPoints<T extends Record<string, unknown>>(row: T | null, ...columns: (keyof T)[]): T | null {
	if (!row) return null
	const result = { ...row }
	for (const column of columns) {
		if (column in result) {
			result[column] = parsePoint(result[column] as Point | string | null) as T[keyof T]
		}
	}
	return result
}

/** Igual que parseRowPoints pero para listas. */
export function parseRowsPoints<T extends Record<string, unknown>>(rows: T[] | null | undefined, ...columns: (keyof T)[]): T[] {
	if (!rows) return []
	return rows.map((row) => parseRowPoints(row, ...columns) as T)
}
