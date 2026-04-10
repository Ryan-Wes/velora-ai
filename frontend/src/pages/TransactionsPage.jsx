import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../index.css'

function TransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)

  const [filters, setFilters] = useState({
    month: '',
    type: '',
    source: '',
  })

  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
  })

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

  const sourceLabels = {
    bank_account: 'Conta',
    credit_card: 'Cartão',
  }

  useEffect(() => {
    async function fetchMonths() {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/transactions/months')

        if (!response.ok) {
          throw new Error('Erro ao buscar meses disponíveis')
        }

        const data = await response.json()
        setMonths(data.months || [])
      } catch (err) {
        setError(err.message || 'Erro ao buscar meses')
      }
    }

    fetchMonths()
  }, [])

  useEffect(() => {
    async function fetchTransactions() {
      try {
        setLoading(true)
        setError('')

        const queryParams = new URLSearchParams()

        if (filters.month) queryParams.append('month', filters.month)
        if (filters.type) queryParams.append('type', filters.type)
        if (filters.source) queryParams.append('source', filters.source)

        queryParams.append('limit', String(pagination.limit))
        queryParams.append('offset', String(pagination.offset))

        const response = await fetch(
          `http://127.0.0.1:8000/api/transactions?${queryParams.toString()}`
        )

        if (!response.ok) {
          throw new Error('Erro ao buscar transações')
        }

        const data = await response.json()

        setTransactions(data.items || [])
        setTotal(data.total || 0)
      } catch (err) {
        setError(err.message || 'Erro inesperado')
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [filters, pagination])

  function handleFilterChange(field, value) {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }))

    setPagination((prev) => ({
      ...prev,
      offset: 0,
    }))
  }

  function formatMonthLabel(month) {
    const [year, monthNumber] = month.split('-')

    const monthNames = {
      '01': 'Janeiro',
      '02': 'Fevereiro',
      '03': 'Março',
      '04': 'Abril',
      '05': 'Maio',
      '06': 'Junho',
      '07': 'Julho',
      '08': 'Agosto',
      '09': 'Setembro',
      '10': 'Outubro',
      '11': 'Novembro',
      '12': 'Dezembro',
    }

    return `${monthNames[monthNumber] || month} ${year}`
  }

  function formatDate(dateString) {
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }

  const currentPage = useMemo(() => {
    return Math.floor(pagination.offset / pagination.limit) + 1
  }, [pagination])

  const totalPages = useMemo(() => {
    if (!total) return 1
    return Math.ceil(total / pagination.limit)
  }, [total, pagination.limit])

  if (loading) {
    return (
      <main>
        <div className="container">
          <h1>Carregando transações...</h1>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main>
        <div className="container">
          <h1>{error}</h1>
        </div>
      </main>
    )
  }

  return (
    <main>
      <div className="container">
        <header className="header">
          <h1>Transações</h1>
          <p>Histórico completo com paginação</p>

          <div style={{ marginTop: '16px' }}>
            <Link to="/" style={{ color: '#a78bfa', textDecoration: 'none' }}>
              ← Voltar ao dashboard
            </Link>
          </div>
        </header>

        <section className="filters">
          <select
            value={filters.month}
            onChange={(e) => handleFilterChange('month', e.target.value)}
          >
            <option value="">Todos os meses</option>

            {months.map((month) => (
              <option key={month} value={month}>
                {formatMonthLabel(month)}
              </option>
            ))}
          </select>

          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
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
            onChange={(e) => handleFilterChange('source', e.target.value)}
          >
            <option value="">Todas as origens</option>
            <option value="bank_account">Conta</option>
            <option value="credit_card">Cartão</option>
          </select>
        </section>

        <section className="table-container">
          <h2>Transações</h2>

          <p style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '12px' }}>
            <span style={{ color: '#dc48f6' }}>●</span> Afeta caixa &nbsp;|&nbsp;
            <span style={{ color: '#aeaeae' }}>●</span> Não afeta
          </p>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Origem</th>
                <th>Caixa</th>
                <th>Valor</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((transaction) => {
                const affectsCash =
                  Number(transaction.is_ignored_in_spending) === 0 &&
                  Number(transaction.is_internal_transfer) === 0

                return (
                  <tr key={transaction.id}>
                    <td>{formatDate(transaction.transaction_date)}</td>
                    <td>{transaction.raw_description}</td>

                    <td>
                      {transactionTypeLabels[transaction.transaction_type] ||
                        transaction.transaction_type}
                      <span
                        style={{
                          marginLeft: '8px',
                          color: affectsCash ? '#dc48f6' : '#aeaeae',
                        }}
                      >
                        ●
                      </span>
                    </td>

                    <td>
                      {sourceLabels[transaction.source_type] || transaction.source_type}
                    </td>

                    <td>{affectsCash ? 'Sim' : 'Não'}</td>

                    <td
                      className={`value ${
                        transaction.direction === 'out' ? 'red' : 'green'
                      }`}
                    >
                      {transaction.direction === 'out' ? '-' : '+'} R${' '}
                      {Number(transaction.absolute_amount).toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '20px',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
              Página {currentPage} de {totalPages} • {total} transações
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    offset: Math.max(prev.offset - prev.limit, 0),
                  }))
                }
                disabled={pagination.offset === 0}
              >
                Anterior
              </button>

              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    offset: prev.offset + prev.limit,
                  }))
                }
                disabled={pagination.offset + pagination.limit >= total}
              >
                Próxima
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default TransactionsPage