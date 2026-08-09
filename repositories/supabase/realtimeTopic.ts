/**
 * Nombre de canal irrepetible para cada suscripción de realtime.
 *
 * `supabase.channel(topic)` NO crea siempre un canal nuevo: si ya existe uno con
 * ese mismo topic, devuelve el que está (RealtimeClient.channel, realtime-js).
 * Y agregarle un `.on('postgres_changes', ...)` a un canal ya suscrito lanza
 * "cannot add postgres_changes callbacks for <topic> after subscribe()".
 *
 * Eso pasaba cada vez que dos pantallas vivas escuchaban lo mismo. El caso
 * concreto: el detalle del partido se suscribe a `requests:<matchId>` y, al tocar
 * "N jugadores quieren unirse", la pantalla de solicitudes pide el mismo nombre —
 * pero el detalle sigue montado en el stack de navegación, así que su canal está
 * vivo y unido. La segunda pantalla recibía ese objeto y moría al montar.
 *
 * El sufijo incremental le da a cada llamada su propio canal, así que dos pantallas
 * pueden mirar la misma tabla sin pisarse. Sin esto, el bug reaparece cada vez que
 * alguien agrega una pantalla que escucha algo que ya escuchaba otra — no es una
 * combinación exótica, es lo normal cuando el stack apila detalle sobre detalle.
 *
 * Compartir el canal tampoco sería una alternativa buena: el primero en
 * desmontarse llama a removeChannel() y le corta la suscripción al otro, en
 * silencio.
 */
let secuencia = 0

export const uniqueTopic = (base: string): string => `${base}:${++secuencia}`
