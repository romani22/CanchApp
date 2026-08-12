/**
 * Saneado del texto que escribe el usuario antes de meterlo en un filtro de PostgREST.
 *
 * Hay dos capas que interpretan caracteres especiales, y hay que pasar por las dos:
 *
 *   1. PostgREST, que en los filtros `like`/`ilike` traduce `*` a `%` antes de armar
 *      el SQL. Un `*` escrito en el buscador se convierte en comodín y devuelve la
 *      tabla entera (hasta el límite). No se puede escapar: mandar `\*` termina
 *      matcheando un `%` literal, que no es lo que el usuario pidió. Así que se saca.
 *   2. Postgres, donde `%` y `_` son los comodines de LIKE y `\` el escape. Esos sí se
 *      escapan, y se hacen en una sola pasada con clase de caracteres para no tener
 *      que pensar en el orden (escapar `\` después de `%` duplicaría las barras).
 *
 * Y la regla que no vive acá pero es la importante: **ningún filtro se arma
 * concatenando texto del usuario**. `.or()` recibe un string con la sintaxis de
 * PostgREST, donde la coma separa condiciones, así que interpolar ahí adentro deja
 * inyectar filtros nuevos — sobre columnas que ni están en el `select`. Para eso
 * están `.ilike()` y `.eq()`, que mandan el valor como parámetro.
 */
export const likePattern = (raw: string): string =>
	raw
		.trim()
		.replace(/\*/g, '')
		.replace(/[%_\\]/g, '\\$&')

/**
 * ¿El texto es un mail completo?
 *
 * Se usa para decidir CÓMO buscar, no para validar: un mail completo busca por
 * igualdad y cualquier otra cosa busca por nombre. La diferencia importa porque
 * buscar mails por subcadena convierte el buscador en un cosechador de direcciones
 * — con dos caracteres y un `@` se lista media base.
 *
 * Deliberadamente más estricto que la validación de registro: acá un falso negativo
 * sólo hace que se busque por nombre, que es el comportamiento seguro.
 */
export const looksLikeEmail = (raw: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim())

/** El límite de resultados nunca lo decide el llamador sin techo. */
export const normalizeSearchLimit = (limit: number): number => Math.max(1, Math.min(Math.trunc(limit) || 1, 10))
