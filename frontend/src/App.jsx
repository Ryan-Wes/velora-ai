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

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError('')

        const [transactionsResponse, summaryResponse] = await Promise.all([
          fetch('http://127.0.0.1:8000/api/transactions'),
          fetch('http://127.0.0.1:8000/api/summary/consolidated'),
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
  }, [])

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

  const chartData =
    summary?.by_type?.map((item) => ({
      name: typeLabels[item.transaction_type] || item.transaction_type,
      value: item.expense_total,
    })) || []

  const sourceLabels = {
    bank_account: 'Conta Bancária',
    credit_card: 'Cartão de Crédito',
  }

  const sourceChartData =
    summary?.by_source_type?.map((item) => ({
      name: sourceLabels[item.source_type] || item.source_type,
      value: item.expense_total,
    })) || []



  if (loading) return <h1>Carregando...</h1>
  if (error) return <h1>{error}</h1>

  return (
    <main>
      <div className="container">

        <header className="header">
          <h1>FinSight AI</h1>
          <p>Análise real do seu fluxo financeiro</p>
        </header>

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
          <h2>Gastos por tipo</h2>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
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
          <h2>Gastos por origem</h2>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={sourceChartData}>
                <XAxis dataKey="name" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip />
                <Bar dataKey="value" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="table-container">
          <h2>Transações</h2>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Valor</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.transaction_date}</td>
                  <td>{t.raw_description}</td>
                  <td>{t.transaction_type}</td>
                  <td className={`value ${t.direction === 'out' ? 'red' : 'green'}`}>
                    {t.direction === 'out' ? '-' : '+'} R$ {Number(t.absolute_amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

      </div>
    </main>
  )
}

export default App