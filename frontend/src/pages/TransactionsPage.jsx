import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../index.css'

const DEFAULT_CATEGORY_OPTIONS = [
  'alimentacao',
  'mercado',
  'compras',
  'transporte',
  'carro',
  'roupas',
  'saude',
  'casa',
  'assinaturas',
  'lazer',
  'investimentos',
  'movimentacoes',
  'outros',
]

const SUBCATEGORY_MAP = {
  alimentacao: ['mercado', 'restaurante', 'delivery', 'padaria'],
  moradia: ['aluguel', 'contas', 'internet', 'manutencao'],
  transporte: ['uber', 'taxi', 'onibus', 'metro'],
  carro: ['combustivel', 'manutencao', 'seguro'],
  saude: ['farmacia', 'consulta', 'exame'],
  vestuario: ['roupas', 'calcados'],
  lazer: ['cinema', 'games', 'viagem'],
  assinaturas: ['streaming', 'software'],
  educacao: ['faculdade', 'curso'],
  outros: ['outros'],
  nao_identificado: ['nao_identificado'],
}

function formatCategoryLabel(category) {
  if (!category) return ''

  const wordMap = {
    saude: 'Saúde',
    alimentacao: 'Alimentação',
    movimentacoes: 'Movimentações',
    educacao: 'Educação',
    ferias: 'Férias',
    folga: 'Folga',
    eletronicos: 'Eletrônicos',
    moveis: 'Móveis',
    credito: 'Crédito',
    debito: 'Débito',
    servicos: 'Serviços',
    tecnologia: 'Tecnologia',
    farmacia: 'Farmácia',
    mecanica: 'Mecânica',
    nao_identificado: 'Não identif.',
  }

  return category
    .split('/')
    .map((part) =>
      part
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((word) => {
          const lower = word.toLowerCase()

          if (wordMap[lower]) {
            return wordMap[lower]
          }

          return lower.charAt(0).toUpperCase() + lower.slice(1)
        })
        .join(' ')
    )
    .join(' / ')
}

function TransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [savingId, setSavingId] = useState(null)
  const [categoryOptions, setCategoryOptions] = useState([
    ...DEFAULT_CATEGORY_OPTIONS,
    '__custom__',
  ])

  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadResults, setUploadResults] = useState([])
  const [uploading, setUploading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  const [filters, setFilters] = useState({
    month: '',
    type: '',
    source: '',
  })

  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
  })

  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [userNote, setUserNote] = useState('')
  const [mainCategory, setMainCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')

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
    async function fetchCategories() {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/transactions/categories')

        if (!response.ok) {
          throw new Error('Erro ao buscar categorias')
        }

        const data = await response.json()
        const customCategories = data.categories || []

        const mergedCategories = [
          ...DEFAULT_CATEGORY_OPTIONS,
          ...customCategories.filter(
            (category) => !DEFAULT_CATEGORY_OPTIONS.includes(category)
          ),
        ]

        const sortedCategories = mergedCategories.sort((a, b) =>
          formatCategoryLabel(a).localeCompare(formatCategoryLabel(b), 'pt-BR', {
            sensitivity: 'base',
          })
        )

        setCategoryOptions([...sortedCategories, '__custom__'])

        setCategoryOptions(mergedCategories)
      } catch (err) {
        console.error(err)
      }
    }

    fetchCategories()
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [filters, pagination])

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

  function handleSelectedFiles(filesList) {
    const filesArray = Array.from(filesList || [])
    setSelectedFiles(filesArray)
  }

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

      const monthsResponse = await fetch('http://127.0.0.1:8000/api/transactions/months')

      if (monthsResponse.ok) {
        const monthsData = await monthsResponse.json()
        setMonths(monthsData.months || [])
      }

      await fetchTransactions()
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
      setTotal(0)
      setMonths([])
      setSelectedFiles([])
      setFilters({
        month: '',
        type: '',
        source: '',
      })
      setPagination({
        limit: 50,
        offset: 0,
      })
    } catch (err) {
      setError(err.message || 'Erro ao limpar base')
    } finally {
      setResetting(false)
    }
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

  function formatCurrency(value) {
    return Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function openEditModal(transaction) {
    setSelectedTransaction(transaction)
    setSelectedCategory(transaction.category || 'outros')
    setCustomCategory('')
    setUserNote(transaction.user_note || '')
    setMainCategory(
      transaction.main_category && transaction.main_category !== 'outros'
        ? transaction.main_category
        : transaction.category || 'outros'
    )
    setSubcategory(transaction.subcategory || '')
  }

  function closeEditModal() {
    setSelectedTransaction(null)
    setSelectedCategory('')
    setCustomCategory('')
    setUserNote('')
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (!selectedTransaction) return

      if (event.key === 'Escape') {
        closeEditModal()
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        saveCategory()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedTransaction, mainCategory, subcategory, userNote, selectedCategory, customCategory])

  async function saveCategory() {
    const finalCategory =
      selectedCategory === '__custom__'
        ? customCategory.trim()
        : selectedCategory

    if (!finalCategory) {
      setError('Digite o nome da nova categoria')
      return
    }

    try {
      setSavingId(selectedTransaction.id)
      setError('')

      const response = await fetch(
        `http://127.0.0.1:8000/api/transactions/${selectedTransaction.id}/category`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            category: finalCategory,
            main_category: mainCategory,
            subcategory: subcategory || null,
            display_description: selectedTransaction.display_description,
            user_note: userNote,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Erro ao atualizar categoria')
      }

      const updatedData = await response.json()

      if (!updatedData.success) {
        throw new Error(updatedData.message || 'Erro ao atualizar categoria')
      }

      setTransactions((prevTransactions) =>
        prevTransactions.map((transaction) =>
          transaction.id === selectedTransaction.id
            ? {
              ...transaction,
              category: updatedData.category,
              main_category: updatedData.main_category,
              subcategory: updatedData.subcategory,
              display_description: updatedData.display_description,
              user_note: updatedData.user_note,
              category_source: updatedData.category_source,
              category_source: updatedData.category_source,
              category_reviewed: updatedData.category_reviewed,
            }
            : transaction
        )
      )

      setCategoryOptions((prevOptions) => {
        const nextOptions = prevOptions.filter((option) => option !== '__custom__')

        if (!nextOptions.includes(updatedData.category)) {
          nextOptions.push(updatedData.category)
        }

        nextOptions.sort((a, b) =>
          formatCategoryLabel(a).localeCompare(formatCategoryLabel(b), 'pt-BR', {
            sensitivity: 'base',
          })
        )

        return [...nextOptions, '__custom__']
      })

      closeEditModal()
    } catch (err) {
      setError(err.message || 'Erro ao salvar categoria')
    } finally {
      setSavingId(null)
    }
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
          <p>Visualize, filtre, importe arquivos e revise categorias</p>
          <div style={{ marginTop: '16px' }}>
            <Link
              to="/"
              style={{ color: '#a78bfa', textDecoration: 'none' }}
            >
              ← Voltar para dashboard
            </Link>
          </div>
        </header>

        <div className="dashboard-toolbar">
          <button
            className="filter-button"
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? 'Ocultar importação' : 'Importar arquivos'}
          </button>
        </div>

        {showUpload && (
          <section className="table-container" style={{ marginBottom: '24px' }}>
            <h2>Importar dados</h2>

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
                Arraste PDFs e CSVs aqui ou escolha no botão
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
                    <div
                      key={`${file.name}-${file.size}`}
                      className="top-category-item"
                    >
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
                    <div
                      key={`${result.filename}-${index}`}
                      className="top-category-item"
                    >
                      <span>{result.original_filename || result.filename}</span>
                      <strong
                        style={{ color: result.error ? '#ef4444' : '#22c55e' }}
                      >
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
        )}

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
            {Object.entries(transactionTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={filters.source}
            onChange={(e) => handleFilterChange('source', e.target.value)}
          >
            <option value="">Todas as origens</option>
            {Object.entries(sourceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </section>

        <section className="table-container">
          <h2>Lista de transações</h2>
          <p>Total encontrado: {total}</p>

          <table>
            <thead>
              <tr>
                <th className="cell-center">Data</th>
                <th className="cell-left">Descrição</th>
                <th>Tipo</th>
                <th className="cell-center">Origem</th>
                <th className="cell-center">Categoria</th>
                <th className="cell-center">Subcategoria</th>
                <th className="cell-center">Definição</th>
                <th className="cell-left">Valor</th>
                <th className="cell-center">Editar</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((transaction) => {
                const hasMissingMainCategory =
                  !transaction.main_category || transaction.main_category.trim() === ''

                const hasMissingSubcategory =
                  !transaction.subcategory || transaction.subcategory.trim() === ''

                const isResolvedAsOthers =
                  transaction.main_category === 'outros' &&
                  transaction.subcategory === 'outros'

                const isResolvedAsNotIdentified =
                  transaction.main_category === 'nao_identificado' &&
                  transaction.subcategory === 'nao_identificado'

                const shouldHighlightRow =
                  hasMissingMainCategory ||
                  hasMissingSubcategory ||
                  (
                    !isResolvedAsOthers &&
                    !isResolvedAsNotIdentified &&
                    (
                      transaction.main_category === 'outros' ||
                      transaction.subcategory === 'outros' ||
                      transaction.main_category === 'nao_identificado' ||
                      transaction.subcategory === 'nao_identificado'
                    )
                  )

                return (
                  <tr
                    key={transaction.id}
                    className={`${shouldHighlightRow ? 'row-needs-category' : ''}
            ${Number(transaction.category_reviewed) === 0 ? 'row-not-reviewed' : ''}`}
                  >
                    <td className="cell-center">
                      {formatDate(transaction.transaction_date)}
                    </td>

                    <td className="cell-left">
                      <span
                        className={`transaction-description ${transaction.user_note ? 'has-note' : ''}`}
                        data-note={transaction.user_note || ''}
                      >
                        {transaction.display_description || transaction.raw_description}
                      </span>
                    </td>

                    <td>
                      {transactionTypeLabels[transaction.transaction_type] ||
                        transaction.transaction_type}
                    </td>

                    <td className="cell-center">
                      {sourceLabels[transaction.source_type] || transaction.source_type}
                    </td>

                    <td className="cell-center">
                      <button
                        type="button"
                        onClick={() => openEditModal(transaction)}
                        className={`category-badge category-trigger category-${transaction.main_category || 'outros'
                          }`}
                      >
                        <span>
                          {formatCategoryLabel(
                            transaction.main_category || transaction.category
                          )}
                        </span>
                        <span className="category-chevron">˅</span>
                      </button>
                    </td>

                    <td className="cell-center">
                      <span
                        className={`category-badge category-${transaction.main_category || 'outros'
                          }`}
                      >
                        {transaction.subcategory
                          ? formatCategoryLabel(transaction.subcategory)
                          : '-'}
                      </span>
                    </td>

                    <td className="cell-center">
                      <span
                        className={`source-badge ${transaction.category_source === 'manual'
                          ? 'source-manual'
                          : 'source-auto'
                          }`}
                      >
                        {transaction.category_source === 'manual' ? 'Manual' : 'Auto'}
                      </span>
                    </td>

                    <td className={transaction.direction === 'in' ? 'green cell-left' : 'red cell-left'}>
                      {transaction.direction === 'in' ? '+' : '-'}{' '}
                      {formatCurrency(transaction.absolute_amount)}
                    </td>

                    <td className="cell-center">
                      <button
                        type="button"
                        className="edit-icon-button"
                        onClick={() => openEditModal(transaction)}
                        aria-label="Editar transação"
                        title="Editar transação"
                      >
                        ✏️
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="pagination">
            <button
              className="secondary-button"
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

            <span>
              Página {currentPage} de {totalPages}
            </span>

            <button
              className="secondary-button"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  offset: prev.offset + prev.limit,
                }))
              }
              disabled={currentPage >= totalPages}
            >
              Próxima
            </button>
          </div>
        </section>
      </div>

      {selectedTransaction && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Editar categoria</h2>

            <div className="modal-content">
              <p>
                <strong>Descrição:</strong> {selectedTransaction.raw_description}
              </p>

              <p>
                <strong>Categoria atual:</strong>{' '}
                {formatCategoryLabel(selectedTransaction.category) || '-'}
              </p>

              <p>
                <strong>Origem:</strong>{' '}
                {selectedTransaction.category_source === 'manual' ? 'Manual' : 'Automática'}
              </p>

              <label className="modal-label">
                Categoria principal
              </label>

              <select
                className="modal-select"
                value={mainCategory}
                onChange={(e) => {
                  const nextMainCategory = e.target.value
                  setMainCategory(nextMainCategory)
                  setSubcategory('')
                }}
              >
                <option value="alimentacao">Alimentação</option>
                <option value="moradia">Moradia</option>
                <option value="transporte">Transporte</option>
                <option value="carro">Carro</option>
                <option value="saude">Saúde</option>
                <option value="vestuario">Vestuário</option>
                <option value="lazer">Lazer</option>
                <option value="assinaturas">Assinaturas</option>
                <option value="educacao">Educação</option>
                <option value="outros">Outros</option>
                <option value="nao_identificado">Não identificado</option>
              </select>

              <label className="modal-label">
                Subcategoria
              </label>

              <select
                className="modal-select"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
              >
                <option value="">Nenhuma</option>

                {(SUBCATEGORY_MAP[mainCategory] || []).map((sub) => (
                  <option key={sub} value={sub}>
                    {formatCategoryLabel(sub)}
                  </option>
                ))}
              </select>

              <label className="modal-label">
                Observação
              </label>

              <input
                type="text"
                className="modal-input"
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="Ex: Pix recebido por fulano dia tal, ou gasto recorrente todo mês, etc"
              />

              <label htmlFor="category-select" className="modal-label">
                Categoria legada
              </label>

              <select
                id="category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="modal-select"
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {formatCategoryLabel(category)}
                  </option>
                ))}
              </select>

              {selectedCategory === '__custom__' && (
                <input
                  type="text"
                  className="modal-input"
                  placeholder="Digite a nova categoria"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                />
              )}
            </div>



            <div className="modal-actions">
              <button
                className="filter-button"
                onClick={saveCategory}
                disabled={savingId === selectedTransaction.id}
              >
                {savingId === selectedTransaction.id ? 'Salvando...' : 'Salvar'}
              </button>

              <button className="secondary-button" onClick={closeEditModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default TransactionsPage