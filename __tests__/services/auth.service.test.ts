import { authService } from '@/services/auth.service'

// ── Supabase mock ────────────────────────────────────────────────────────────
// jest.mock() es hoisted por Babel antes de las declaraciones de variables,
// por lo que el mock debe ser auto-contenido. Accedemos al mock via requireMock.
// El borrado de la cuenta orquesta el avatar y la RPC, así que hace falta el
// servicio de storage mockeado y un supabase.rpc.
jest.mock('@/services/storage.service', () => ({
  storageService: {
    deleteAvatar: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
}))

 
const mockAuth = (jest.requireMock('@/lib/supabase') as { supabase: { auth: Record<string, jest.Mock> } }).supabase.auth

const mockRpc = (jest.requireMock('@/lib/supabase') as { supabase: { rpc: jest.Mock } }).supabase.rpc

const mockStorage = (jest.requireMock('@/services/storage.service') as { storageService: Record<string, jest.Mock> }).storageService

// ────────────────────────────────────────────────────────────────────────────

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── validateEmail ──────────────────────────────────────────────────────────
  describe('validateEmail', () => {
    it('acepta un email válido básico', () => {
      expect(authService.validateEmail('usuario@example.com')).toBe(true)
    })

    it('acepta email con subdominio', () => {
      expect(authService.validateEmail('user@mail.domain.com')).toBe(true)
    })

    it('acepta email con caracteres especiales en el local part', () => {
      expect(authService.validateEmail('user.name+tag@example.com')).toBe(true)
    })

    it('elimina espacios en los extremos antes de validar', () => {
      expect(authService.validateEmail('  user@example.com  ')).toBe(true)
    })

    it('rechaza email sin @', () => {
      expect(authService.validateEmail('noAtSign.com')).toBe(false)
    })

    it('rechaza email sin dominio', () => {
      expect(authService.validateEmail('user@')).toBe(false)
    })

    it('rechaza email sin local part', () => {
      expect(authService.validateEmail('@domain.com')).toBe(false)
    })

    it('rechaza string vacío', () => {
      expect(authService.validateEmail('')).toBe(false)
    })

    it('rechaza email con más de 254 caracteres', () => {
      // 250 'a' + '@b.com' (6) = 256 chars > 254
      const longEmail = 'a'.repeat(250) + '@b.com'
      expect(longEmail.length).toBeGreaterThan(254)
      expect(authService.validateEmail(longEmail)).toBe(false)
    })

    it('rechaza email con espacios en el medio (tras trim sigue siendo inválido)', () => {
      expect(authService.validateEmail('user name@example.com')).toBe(false)
    })
  })

  // ── validatePassword ───────────────────────────────────────────────────────
  describe('validatePassword', () => {
    it('valida una contraseña fuerte como correcta', () => {
      const result = authService.validatePassword('StrongPass1')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('devuelve error cuando la contraseña tiene menos de 8 caracteres', () => {
      const result = authService.validatePassword('Abc1')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('La contraseña debe tener al menos 8 caracteres')
    })

    it('devuelve error cuando no hay letra mayúscula', () => {
      const result = authService.validatePassword('allower123')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Debe incluir al menos una letra mayúscula')
    })

    it('devuelve error cuando no hay letra minúscula', () => {
      const result = authService.validatePassword('ALLCAPS123')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Debe incluir al menos una letra minúscula')
    })

    it('devuelve error cuando no hay número', () => {
      const result = authService.validatePassword('NoNumbers!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Debe incluir al menos un número')
    })

    it('acumula múltiples errores para contraseña muy débil', () => {
      const result = authService.validatePassword('abc')
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(3)
    })

    it('acepta exactamente 8 caracteres con todos los requisitos', () => {
      const result = authService.validatePassword('Abcde1fg')
      expect(result.isValid).toBe(true)
    })
  })

  // ── signIn ─────────────────────────────────────────────────────────────────
  describe('signIn', () => {
    it('retorna error null en inicio de sesión exitoso', async () => {
      mockAuth.signInWithPassword.mockResolvedValue({ error: null })

      const result = await authService.signIn('user@example.com', 'Password1')

      expect(result.error).toBeNull()
      expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'Password1',
      })
    })

    it('retorna el error de Supabase cuando las credenciales son inválidas', async () => {
      const mockError = new Error('Invalid login credentials')
      mockAuth.signInWithPassword.mockResolvedValue({ error: mockError })

      const result = await authService.signIn('user@example.com', 'WrongPass1')

      expect(result.error).toBe(mockError)
    })

    it('llama a signInWithPassword con los parámetros correctos', async () => {
      mockAuth.signInWithPassword.mockResolvedValue({ error: null })

      await authService.signIn('test@test.com', 'Test1234')

      expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(1)
      expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'Test1234',
      })
    })
  })

  // ── signUp ─────────────────────────────────────────────────────────────────
  describe('signUp', () => {
    it('retorna el id del usuario en registro exitoso', async () => {
      mockAuth.signUp.mockResolvedValue({
        data: { user: { id: 'user-uuid-123' } },
        error: null,
      })

      const result = await authService.signUp('new@user.com', 'Password1', 'Juan Pérez')

      expect(result.error).toBeNull()
      expect(result.data.id).toBe('user-uuid-123')
    })

    it('retorna id vacío cuando user es null', async () => {
      mockAuth.signUp.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const result = await authService.signUp('new@user.com', 'Password1', 'Juan Pérez')

      expect(result.data.id).toBe('')
    })

    it('retorna error cuando falla el registro', async () => {
      const mockError = new Error('Email already registered')
      mockAuth.signUp.mockResolvedValue({
        data: { user: null },
        error: mockError,
      })

      const result = await authService.signUp('existing@user.com', 'Password1', 'Juan Pérez')

      expect(result.error).toBe(mockError)
    })

    it('envía full_name en las opciones de data', async () => {
      mockAuth.signUp.mockResolvedValue({
        data: { user: { id: 'abc' } },
        error: null,
      })

      await authService.signUp('new@user.com', 'Password1', 'María García')

      expect(mockAuth.signUp).toHaveBeenCalledWith({
        email: 'new@user.com',
        password: 'Password1',
        options: { data: { full_name: 'María García' } },
      })
    })
  })

  // ── signOut ────────────────────────────────────────────────────────────────
  describe('signOut', () => {
    it('retorna error null en cierre de sesión exitoso', async () => {
      mockAuth.signOut.mockResolvedValue({ error: null })

      const result = await authService.signOut()

      expect(result.error).toBeNull()
      expect(mockAuth.signOut).toHaveBeenCalledTimes(1)
    })

    it('retorna el error cuando Supabase falla al cerrar sesión', async () => {
      const mockError = new Error('Network error')
      mockAuth.signOut.mockResolvedValue({ error: mockError })

      const result = await authService.signOut()

      expect(result.error).toBe(mockError)
    })
  })

  // ── resetPassword ──────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    it('llama a resetPasswordForEmail con la URL de redirección correcta', async () => {
      mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null })

      const result = await authService.resetPassword('user@example.com')

      expect(result.error).toBeNull()
      expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
        redirectTo: 'canchapp://auth/reset-password',
      })
    })

    it('retorna error cuando Supabase falla', async () => {
      const mockError = new Error('User not found')
      mockAuth.resetPasswordForEmail.mockResolvedValue({ error: mockError })

      const result = await authService.resetPassword('noexiste@example.com')

      expect(result.error).toBe(mockError)
    })
  })

  // ── updatePassword ─────────────────────────────────────────────────────────
  describe('updatePassword', () => {
    it('llama a updateUser con la nueva contraseña', async () => {
      mockAuth.updateUser.mockResolvedValue({ error: null })

      const result = await authService.updatePassword('NewPassword1')

      expect(result.error).toBeNull()
      expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'NewPassword1' })
    })

    it('retorna el error de Supabase si falla la actualización', async () => {
      const mockError = new Error('Weak password')
      mockAuth.updateUser.mockResolvedValue({ error: mockError })

      const result = await authService.updatePassword('weak')

      expect(result.error).toBe(mockError)
    })
  })

  // ── deleteAccount (028) ────────────────────────────────────────────────────
  describe('deleteAccount', () => {
    beforeEach(() => {
      mockStorage.deleteAvatar.mockResolvedValue(undefined)
      mockRpc.mockResolvedValue({ error: null })
    })

    it('borra el avatar ANTES de llamar a la RPC', async () => {
      // El orden no es un detalle: después de la RPC no hay sesión con la que
      // autorizar el borrado del archivo, así que invertirlo deja la foto para
      // siempre en el bucket.
      const orden: string[] = []
      mockStorage.deleteAvatar.mockImplementation(async () => {
        orden.push('avatar')
      })
      mockRpc.mockImplementation(async () => {
        orden.push('rpc')
        return { error: null }
      })

      await authService.deleteAccount('user-1')

      expect(orden).toEqual(['avatar', 'rpc'])
      expect(mockStorage.deleteAvatar).toHaveBeenCalledWith('user-1')
      expect(mockRpc).toHaveBeenCalledWith('delete_my_account')
    })

    it('borra la cuenta igual si falla el borrado del avatar', async () => {
      // Borrar la cuenta es un derecho del usuario: no puede quedar bloqueado
      // porque el storage tuvo un mal momento. El costo es una foto huérfana.
      mockStorage.deleteAvatar.mockRejectedValue(new Error('sin red'))

      await expect(authService.deleteAccount('user-1')).resolves.toBeUndefined()

      expect(mockRpc).toHaveBeenCalledWith('delete_my_account')
    })

    it('propaga el error de la RPC: si no se borró, hay que decirlo', async () => {
      // Dejar a alguien creyendo que borró sus datos cuando siguen ahí es peor
      // que el error.
      mockRpc.mockResolvedValue({ error: new Error('permission denied') })

      await expect(authService.deleteAccount('user-1')).rejects.toThrow('permission denied')
    })

    it('nunca manda el id del usuario a la RPC', async () => {
      // La función del servidor resuelve a quién borrar con auth.uid(). Si el
      // cliente empezara a mandar un id, la puerta para borrar cuentas ajenas
      // quedaría abierta del lado del servidor.
      await authService.deleteAccount('user-1')

      expect(mockRpc).toHaveBeenCalledWith('delete_my_account')
      expect(mockRpc.mock.calls[0]).toHaveLength(1)
    })
  })
})
