import { useCallback, useEffect, useRef, useState } from 'react'
import { Keyboard, LayoutChangeEvent, Platform, ScrollView } from 'react-native'

/**
 * Hace que un ScrollView respete el teclado.
 *
 * En Android con edge-to-edge (`edgeToEdgeEnabled: true` en app.json, obligatorio
 * desde Android 15) el sistema ya NO redimensiona la ventana al abrir el teclado:
 * el ScrollView sigue midiendo la pantalla completa y el teclado tapa la mitad de
 * abajo. Sin nada que compense, enfocar un campo que quedó ahí abajo — como
 * "Observaciones" o "Localidad" en Crear/Editar partido — deja al usuario
 * escribiendo a ciegas.
 *
 * Dos piezas:
 *
 *   1. `keyboardHeight` para sumar al paddingBottom del contentContainer. Sin ese
 *      espacio extra el scroll no tiene a dónde ir y scrollTo() queda clavado.
 *   2. `onFieldFocus(key)` scrollea la sección registrada con `onSectionLayout(key)`
 *      hasta arriba del viewport, que siempre está por encima del teclado.
 *
 * Se resuelve con las APIs de RN a propósito: la alternativa
 * (react-native-keyboard-controller) es una dependencia nativa y obliga a
 * rebuildear en EAS.
 *
 * Uso:
 *
 *   const { scrollRef, keyboardHeight, onSectionLayout, onFieldFocus } = useKeyboardAwareScroll()
 *
 *   <ScrollView ref={scrollRef} contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + keyboardHeight }]}>
 *     <View onLayout={onSectionLayout('notes')}>
 *       <TextInput onFocus={onFieldFocus('notes')} multiline />
 *     </View>
 *   </ScrollView>
 *
 * Las secciones tienen que ser hijas directas del contentContainer: `onLayout` da
 * la `y` relativa al padre.
 */

/** Aire entre el borde superior del viewport y la sección enfocada. */
const TOP_GAP = 12

export function useKeyboardAwareScroll() {
	const scrollRef = useRef<ScrollView>(null)
	const [keyboardHeight, setKeyboardHeight] = useState(0)
	// Espejo en ref: los listeners de Keyboard se registran una sola vez y no ven
	// el state actualizado.
	const keyboardHeightRef = useRef(0)
	const offsets = useRef<Record<string, number>>({})
	const pendingKey = useRef<string | null>(null)

	const scrollToKey = useCallback((key: string) => {
		const y = offsets.current[key]
		if (y == null) return
		scrollRef.current?.scrollTo({ y: Math.max(0, y - TOP_GAP), animated: true })
	}, [])

	useEffect(() => {
		const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
		const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

		const showSub = Keyboard.addListener(showEvent, (e) => {
			const height = e.endCoordinates?.height ?? 0
			keyboardHeightRef.current = height
			setKeyboardHeight(height)

			// El scroll va después de que React aplique el paddingBottom nuevo: si
			// scrolleamos antes, el contenido todavía no llega tan abajo y RN clampea.
			const key = pendingKey.current
			if (key) {
				setTimeout(() => scrollToKey(key), Platform.OS === 'ios' ? 60 : 140)
			}
		})

		const hideSub = Keyboard.addListener(hideEvent, () => {
			keyboardHeightRef.current = 0
			setKeyboardHeight(0)
			pendingKey.current = null
		})

		return () => {
			showSub.remove()
			hideSub.remove()
		}
	}, [scrollToKey])

	/** onLayout de la sección: guarda su `y` dentro del contentContainer. */
	const onSectionLayout = useCallback(
		(key: string) => (e: LayoutChangeEvent) => {
			offsets.current[key] = e.nativeEvent.layout.y
		},
		[],
	)

	/** onFocus del campo: deja la sección visible arriba del teclado. */
	const onFieldFocus = useCallback(
		(key: string) => () => {
			pendingKey.current = key
			// Teclado ya abierto (el usuario salta de un campo a otro): el padding está
			// puesto, así que scrolleamos sin esperar el evento de show que no va a venir.
			if (keyboardHeightRef.current > 0) {
				setTimeout(() => scrollToKey(key), 60)
			}
		},
		[scrollToKey],
	)

	return { scrollRef, keyboardHeight, onSectionLayout, onFieldFocus }
}
