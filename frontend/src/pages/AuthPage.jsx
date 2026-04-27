import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import logo from '../assets/logo-full.png'

function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
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
    <main>
      <div className="container">
        <section
          className="table-container"
          style={{
            maxWidth: 460,
            margin: '80px auto',
            padding: 32,
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img
              src={logo}
              alt="Velora AI"
              style={{
                width: 180,
                maxWidth: '100%',
                marginBottom: 16,
              }}
            />

            <h1>{isLogin ? 'Entrar na Velora AI' : 'Criar conta'}</h1>

            <p style={{ color: '#a1a1aa', marginTop: 8 }}>
              Clareza financeira com inteligência artificial.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="modal-label">E-mail</label>
            <input
              className="modal-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              required
            />

            <label className="modal-label">Senha</label>
            <input
              className="modal-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />

            {error && (
              <p className="form-error-message">
                {error}
              </p>
            )}

            {message && (
              <p style={{ color: '#22c55e', marginTop: 12 }}>
                {message}
              </p>
            )}

            <button
              type="submit"
              className="filter-button"
              disabled={loading}
              style={{ width: '100%', marginTop: 18 }}
            >
              {loading
                ? 'Processando...'
                : isLogin
                  ? 'Entrar'
                  : 'Criar conta'}
            </button>
          </form>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setMode(isLogin ? 'register' : 'login')
              setError('')
              setMessage('')
            }}
            style={{ width: '100%', marginTop: 14 }}
          >
            {isLogin
              ? 'Ainda não tenho conta'
              : 'Já tenho conta'}
          </button>
        </section>
      </div>
    </main>
  )
}

export default AuthPage