import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import logo from '../assets/logo-full.png'

function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isLogin = mode === 'login'

  async function handleSubmit(event) {
    event.preventDefault()

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const payload = {
        email,
        password,
      }

      const { error: authError } = isLogin
        ? await supabase.auth.signInWithPassword(payload)
        : await supabase.auth.signUp(payload)

      if (authError) {
        throw authError
      }

      if (isLogin) {
        setMessage('Login realizado com sucesso.')
        setRedirecting(true)

        setTimeout(() => {
          navigate('/')
        }, 2900)
      } else {
        setMessage('Cadastro criado. Verifique seu e-mail, se a confirmação estiver ativa.')
      }
    } catch (err) {
      setError(err.message || 'Erro ao autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">

      {redirecting && (
        <div className="auth-transition">
          <div className="auth-transition-card">
            <img src={logo} alt="Velora AI" />
            <span>Preparando seu dashboard...</span>
          </div>
        </div>
      )}

      <div className="auth-layout">

        {/* LADO ESQUERDO */}
        <div className="auth-left">
          <img src={logo} alt="Velora AI" className="auth-logo" />

          <p className="auth-tagline">
            Clareza financeira com inteligência artificial.
          </p>

          <div className="auth-benefits">
            <p>📊 Visualize seus gastos</p>
            <p>📂 Importe suas faturas</p>
            <p>🤖 Receba sugestões com IA</p>
          </div>
        </div>

        {/* LADO DIREITO */}
        <div className="auth-right">
          <div className="auth-card">

            <h2>{isLogin ? 'Entrar' : 'Criar conta'}</h2>

            <form onSubmit={handleSubmit}>
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                required
              />

              <label>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />

              {error && <p className="auth-error">{error}</p>}
              {message && <p className="auth-success">{message}</p>}

              <button type="submit" disabled={loading}>
                {loading
                  ? 'Processando...'
                  : isLogin
                    ? 'Entrar'
                    : 'Criar conta'}
              </button>
            </form>

            <button
              type="button"
              className="auth-switch"
              onClick={() => {
                setMode(isLogin ? 'register' : 'login')
                setError('')
                setMessage('')
              }}
            >
              {isLogin
                ? 'Ainda não tenho conta'
                : 'Já tenho conta'}
            </button>

          </div>
        </div>

      </div>
    </main>
  )
}

export default AuthPage