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
  const [byCategory, setByCategory] = useState([])
  const [monthlyTrend, setMonthlyTrend] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadResults, setUploadResults] = useState([])
  const [uploading, setUploading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const [filters, setFilters] = useState({
    month: '',
    type: '',
    source: '',
  })

  const categoryChartData =
    byCategory.map((item) => ({
      name: item.category,
      value: item.expense_total,
    })) || []

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError('')

        const queryParams = new URLSearchParams()

        if (filters.month) queryParams.append('month', filters.month)
        if (filters.type) queryParams.append('type', filters.type)
        if (filters.source) queryParams.append('source', filters.source)
        queryParams.append('limit', 100)

        const queryString = queryParams.toString()

        const monthsResponse = await fetch(
          'http://127.0.0.1:8000/api/transactions/months'
        )

        if (!monthsResponse.ok) {
          throw new Error('Erro ao buscar meses')
        }

        const monthsData = await monthsResponse.json()
        setMonths(monthsData.months || [])

        const [
          transactionsResponse,
          summaryResponse,
          byCategoryResponse,
          monthlyTrendResponse,
        ] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/transactions?${queryString}`),
          fetch(`http://127.0.0.1:8000/api/summary/consolidated?${queryString}`),
          fetch(`http://127.0.0.1:8000/api/summary/by-category?${queryString}`),
          fetch(`http://127.0.0.1:8000/api/summary/monthly-trend?type=${filters.type}&source=${filters.source}`),
        ])

        if (
          !transactionsResponse.ok ||
          !summaryResponse.ok ||
          !byCategoryResponse.ok ||
          !monthlyTrendResponse.ok
        ) {
          throw new Error('Erro ao buscar dados da API')
        }

        const transactionsData = await transactionsResponse.json()
        const summaryData = await summaryResponse.json()
        const byCategoryData = await byCategoryResponse.json()
        const monthlyTrendData = await monthlyTrendResponse.json()

        setTransactions(transactionsData.items || [])
        setSummary(summaryData)
        setByCategory(byCategoryData.by_category || [])
        setMonthlyTrend(monthlyTrendData.monthly_trend || [])
      } catch (err) {
        setError(err.message || 'Erro inesperado')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [filters])

  async function handleUploadFiles() {
    if (!selectedFiles.length) {
      return
    }

    try {
      setUploading(true)
      setError('')

      const formData = new FormData()

      selectedFiles.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch('http://127.0.0.1:8000/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Erro ao enviar arquivos')
      }

      const data = await response.json()
      setUploadResults(data.results || [])
      setSelectedFiles([])

      const queryParams = new URLSearchParams()
      if (filters.month) queryParams.append('month', filters.month)
      if (filters.type) queryParams.append('type', filters.type)
      if (filters.source) queryParams.append('source', filters.source)
      queryParams.append('limit', 100)

      const queryString = queryParams.toString()

      const [
        transactionsResponse,
        summaryResponse,
        byCategoryResponse,
        monthlyTrendResponse,
      ] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/transactions?${queryString}`),
        fetch(`http://127.0.0.1:8000/api/summary/consolidated?${queryString}`),
        fetch(`http://127.0.0.1:8000/api/summary/by-category?${queryString}`),
        fetch(
          `http://127.0.0.1:8000/api/summary/monthly-trend?type=${filters.type}&source=${filters.source}`
        ),
      ])

      if (
        !transactionsResponse.ok ||
        !summaryResponse.ok ||
        !byCategoryResponse.ok ||
        !monthlyTrendResponse.ok
      ) {
        throw new Error('Erro ao atualizar dashboard após upload')
      }

      const transactionsData = await transactionsResponse.json()
      const summaryData = await summaryResponse.json()
      const byCategoryData = await byCategoryResponse.json()
      const monthlyTrendData = await monthlyTrendResponse.json()

      setTransactions(transactionsData.items || [])
      setSummary(summaryData)
      setByCategory(byCategoryData.by_category || [])
      setMonthlyTrend(monthlyTrendData.monthly_trend || [])
    } catch (err) {
      setError(err.message || 'Erro ao enviar arquivos')
    } finally {
      setUploading(false)
    }
  }

  async function handleResetDatabase() {
    try {
      setResetting(true)
      setError('')
      setUploadResults([])

      const response = await fetch('http://127.0.0.1:8000/api/dev/reset', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Erro ao limpar base')
      }

      setTransactions([])
      setSummary({
        real_income: 0,
        real_expenses: 0,
        net_cashflow: 0,
      })
      setByCategory([])
      setMonthlyTrend([])
      setMonths([])
      setSelectedFiles([])
      setFilters({
        month: '',
        type: '',
        source: '',
      })
    } catch (err) {
      setError(err.message || 'Erro ao limpar base')
    } finally {
      setResetting(false)
    }
  }

  function handleSelectedFiles(filesList) {
    const filesArray = Array.from(filesList || [])
    setSelectedFiles(filesArray)
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

  const reviewPendingCount = transactions.filter(
    (transaction) =>
      transaction.category === 'outros' ||
      Number(transaction.category_reviewed) === 0
  ).length

  const uncategorizedCount = transactions.filter(
    (transaction) => transaction.category === 'outros'
  ).length

  const notReviewedCount = transactions.filter(
    (transaction) => Number(transaction.category_reviewed) === 0
  ).length

  const topCategories = [...byCategory]
    .sort((a, b) => b.expense_total - a.expense_total)
    .slice(0, 5)

  const biggestCategory = topCategories[0]

  const worstMonth = [...monthlyTrend]
    .sort((a, b) => a.cashflow - b.cashflow)[0]

  const bestMonth = [...monthlyTrend]
    .sort((a, b) => b.cashflow - a.cashflow)[0]

  const monthlyTrendChartData = monthlyTrend.map((item) => ({
    name: item.month.split('-').reverse().join('/'),
    income: item.income,
    expenses: item.expenses,
    cashflow: item.cashflow,
  }))



  if (loading) return <h1>Carregando...</h1>
  if (error) return <h1>{error}</h1>

  return (
    <main>
      <div className="container">
        <header className="header">
          <h1>FinSight AI</h1>
          <p>Análise real do seu fluxo financeiro</p>
          <div style={{ marginTop: '16px' }}>
            <a
              href="/transactions"
              style={{ color: '#a78bfa', textDecoration: 'none' }}
            >
              Ver transações →
            </a>
          </div>
        </header>

        <section className="table-container" style={{ marginBottom: '24px' }}>
          <h2>Importação de arquivos</h2>

          <div
            className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragging(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              handleSelectedFiles(e.dataTransfer.files)
            }}
          >
            <p className="upload-title">
              Arraste PDFs/CSVs aqui ou escolha no botão
            </p>

            <p className="upload-subtitle">
              Você pode enviar vários arquivos de uma vez
            </p>

            <div className="upload-actions">
              <label className="filter-button upload-label">
                Escolher arquivos
                <input
                  type="file"
                  multiple
                  accept=".pdf,.csv"
                  className="hidden-file-input"
                  onChange={(e) => handleSelectedFiles(e.target.files)}
                />
              </label>

              <button
                className="filter-button"
                onClick={handleUploadFiles}
                disabled={uploading || !selectedFiles.length}
              >
                {uploading ? 'Enviando...' : 'Enviar arquivos'}
              </button>

              <button
                className="secondary-button"
                onClick={handleResetDatabase}
                disabled={resetting}
              >
                {resetting ? 'Limpando...' : 'Limpar base'}
              </button>
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '12px' }}>
                Arquivos selecionados ({selectedFiles.length})
              </h3>

              <div className="top-category-list">
                {selectedFiles.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="top-category-item">
                    <span>{file.name}</span>
                    <strong>{(file.size / 1024).toFixed(1)} KB</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadResults.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '12px' }}>
                Resultado do upload
              </h3>

              <div className="top-category-list">
                {uploadResults.map((result, index) => (
                  <div key={`${result.filename}-${index}`} className="top-category-item">
                    <span>{result.original_filename || result.filename}</span>
                    <strong style={{ color: result.error ? '#ef4444' : '#22c55e' }}>
                      {result.error
                        ? `Erro: ${result.error}`
                        : `OK • inseridas: ${result.inserted_count ?? 0} • ignoradas: ${result.skipped_count ?? 0}`}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}

        </section>

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


            <div className="card">
              <p>Pendências de revisão</p>
              <h2 className="red">
                {transactions.filter(
                  (transaction) =>
                    transaction.category === 'outros' ||
                    Number(transaction.category_reviewed) === 0
                ).length}
              </h2>
            </div>
          </section>
        )}

        <section className="table-container" style={{ marginBottom: '32px' }}>
          <h2>Evolução mensal</h2>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendChartData}>
                <XAxis dataKey="name" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip />
                <Bar dataKey="income" fill="#22c55e" />
                <Bar dataKey="expenses" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="table-container" style={{ marginBottom: '32px' }}>
          <h2>Insights</h2>

          <div className="review-summary">
            {biggestCategory && (
              <div className="review-item">
                <span>Maior gasto</span>
                <strong>
                  {biggestCategory.category} (
                  R$ {Number(biggestCategory.expense_total).toFixed(2)})
                </strong>
              </div>
            )}

            {worstMonth && (
              <div className="review-item">
                <span>Pior mês</span>
                <strong>
                  {worstMonth.month} (
                  R$ {Number(worstMonth.cashflow).toFixed(2)})
                </strong>
              </div>
            )}

            {bestMonth && (
              <div className="review-item">
                <span>Melhor mês</span>
                <strong>{bestMonth.month}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="dashboard-grid" style={{ marginBottom: '32px' }}>
          <div className="table-container">
            <h2>Resumo de revisão</h2>

            <div className="review-summary">
              <div className="review-item">
                <span>Total pendente</span>
                <strong>{reviewPendingCount}</strong>
              </div>

              <div className="review-item">
                <span>Categoria "Outros"</span>
                <strong>{uncategorizedCount}</strong>
              </div>

              <div className="review-item">
                <span>Não revisadas</span>
                <strong>{notReviewedCount}</strong>
              </div>
            </div>
          </div>

          <div className="table-container">
            <h2>Maiores categorias</h2>

            <div className="top-category-list">
              {topCategories.map((item) => (
                <div key={item.category} className="top-category-item">
                  <span>{item.category}</span>
                  <strong>R$ {Number(item.expense_total).toFixed(2)}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>




      </div>
    </main>
  )
}

export default App