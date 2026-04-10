import { useEffect, useState } from 'react'
import './index.css'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

function App() {
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [months, setMonths] = useState([])

  // ✅ NOVO: estado de filtros
  const [filters, setFilters] = useState({
    month: '',
    type: '',
    source: '',
  })

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError('')

        // ✅ monta query dinamicamente
        const queryParams = new URLSearchParams()

        if (filters.month) queryParams.append('month', filters.month)
        if (filters.type) queryParams.append('type', filters.type)
        if (filters.source) queryParams.append('source', filters.source)
        queryParams.append('limit', 100)

        const queryString = queryParams.toString()

        const monthsResponse = await fetch('http://127.0.0.1:8000/api/transactions/months')

        if (!monthsResponse.ok) {
          throw new Error('Erro ao buscar meses')
        }

        const monthsData = await monthsResponse.json()
        setMonths(monthsData.months || [])

        const [transactionsResponse, summaryResponse] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/transactions?${queryString}`),
          fetch(`http://127.0.0.1:8000/api/summary/consolidated?${queryString}`),
        ])

        if (!transactionsResponse.ok || !summaryResponse.ok) {
          throw new Error('Erro ao buscar dados da API')
        }

        const transactionsData = await transactionsResponse.json()
        const summaryData = await summaryResponse.json()

        setTransactions(transactionsData.items || [])
        setSummary(summaryData)
      } catch (err) {
        setError(err.message || 'Erro inesperado')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [filters]) // ✅ AGORA REAGE AOS FILTROS

  const typeLabels = {
    pix_out: 'Pix Enviado',
    pix_in: 'Pix Recebido',
    transfer_in: 'Transferência Recebida',
    transfer_out: 'Transferência Enviada',
    bill_payment: 'Boleto',
    credit_card_bill_payment: 'Fatura Cartão',
    investment_application: 'Aplicação',
    investment_redemption: 'Resgate',
    refund: 'Estorno',
  }

  const transactionTypeLabels = {
    purchase: 'Compra Cartão',
    pix_out: 'Pix Enviado',
    pix_in: 'Pix Recebido',
    transfer_in: 'Transf. Receb.',
    transfer_out: 'Transf. Env.',
    bill_payment: 'Pag. Boleto',
    credit_card_bill_payment: 'Fatura Cartão',
    investment_application: 'Aplicação Caix.',
    investment_redemption: 'Resgate Caix.',
    refund: 'Estorno',
    iof: 'Taxa IOF',
    bank_transaction: 'Mov. Bancária',
  }

  const chartData =
    summary?.by_type?.map((item) => ({
      name: transactionTypeLabels[item.transaction_type] || item.transaction_type,
      value: item.income_total + item.expense_total,
    })) || []

  const sourceLabels = {
    bank_account: 'Conta Bancária',
    credit_card: 'Cartão de Crédito',
  }

  const sourceChartData =
    summary?.by_source_type?.map((item) => ({
      name: sourceLabels[item.source_type] || item.source_type,
      value: item.income_total + item.expense_total,
    })) || []

  if (loading) return <h1>Carregando...</h1>
  if (error) return <h1>{error}</h1>


  return (
    <main>
      <div className="container">

        <header className="header">
          <h1>FinSight AI</h1>
          <p>Análise real do seu fluxo financeiro</p>
          <div style={{ marginTop: '16px' }}>
            <a href="/transactions" style={{ color: '#a78bfa', textDecoration: 'none' }}>
              Ver transações →
            </a>
          </div>
        </header>

        {/* 🔥 FILTROS */}
        <section className="filters">
          <select
            value={filters.month}
            onChange={(e) =>
              setFilters({ ...filters, month: e.target.value })
            }
          >
            <option value="">Todos os meses</option>

            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={filters.type}
            onChange={(e) =>
              setFilters({ ...filters, type: e.target.value })
            }
          >
            <option value="">Todos os tipos</option>

            <option value="credit_card_bill_payment">Fatura Cartão</option>
            <option value="purchase">Compra no Cartão</option>

            <option value="pix_out">Pix Enviado</option>
            <option value="pix_in">Pix Recebido</option>

            <option value="transfer_out">Transferência Enviada</option>
            <option value="transfer_in">Transferência Recebida</option>

            <option value="bill_payment">Boleto</option>
            <option value="investment_application">Aplicação</option>
            <option value="investment_redemption">Resgate</option>
            <option value="refund">Estorno</option>
          </select>

          <select
            value={filters.source}
            onChange={(e) =>
              setFilters({ ...filters, source: e.target.value })
            }
          >
            <option value="">Todas as origens</option>
            <option value="bank_account">Conta</option>
            <option value="credit_card">Cartão</option>
          </select>
        </section>

        {summary && (
          <section className="cards">
            <div className="card">
              <p>Receita Real</p>
              <h2 className="green">
                R$ {Number(summary.real_income).toFixed(2)}
              </h2>
            </div>

            <div className="card">
              <p>Despesa Real</p>
              <h2 className="red">
                R$ {Number(summary.real_expenses).toFixed(2)}
              </h2>
            </div>

            <div className="card">
              <p>Cashflow</p>
              <h2 className={summary.net_cashflow >= 0 ? 'green' : 'red'}>
                R$ {Number(summary.net_cashflow).toFixed(2)}
              </h2>
            </div>
          </section>
        )}

        <section className="table-container" style={{ marginBottom: '32px' }}>
          <h2>Movimentação por tipo</h2>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip />
                <Bar dataKey="value" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="table-container" style={{ marginBottom: '32px' }}>
          <h2>Movimentação por origem</h2>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceChartData}>
                <XAxis dataKey="name" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip />
                <Bar dataKey="value" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>



      </div>
    </main>
  )
}

export default App