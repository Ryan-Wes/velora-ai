import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import logo from '../assets/logo-full.png'

const MIN_PASSWORD_LENGTH = 8

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [hasSession, setHasSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session))
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session))
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        throw updateError
      }

      setMessage('Senha alterada com sucesso. Redirecionando...')

      setTimeout(() => {
        navigate('/')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Erro ao alterar a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <div className="auth-left">
          <img src={logo} alt="Velora AI" className="auth-logo" />

          <p className="auth-tagline">
            Clareza financeira com inteligência artificial.
          </p>
        </div>

        <div className="auth-right">
          <div className="auth-card">
            <h2>Definir nova senha</h2>

            {hasSession === false ? (
              <>
                <p className="auth-error">
                  Link inválido ou expirado. Peça um novo link de recuperação.
                </p>

                <button
                  type="button"
                  className="auth-switch"
                  onClick={() => navigate('/auth')}
                >
                  Voltar para o login
                </button>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <label>Nova senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                />

                <label>Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a nova senha"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                />

                {error && <p className="auth-error">{error}</p>}
                {message && <p className="auth-success">{message}</p>}

                <button type="submit" disabled={loading || hasSession === null}>
                  {loading ? 'Salvando...' : 'Salvar nova senha'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default ResetPasswordPage
