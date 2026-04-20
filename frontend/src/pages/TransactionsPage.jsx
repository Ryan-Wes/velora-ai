import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../index.css'
import { getCategoryDisplayColor } from '../utils/categoryStyle'



const FALLBACK_SUBCATEGORY_MAP = {
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
  const [successMessage, setSuccessMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [total, setTotal] = useState(0)
  const [savingId, setSavingId] = useState(null)


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
  const [userNote, setUserNote] = useState('')
  const [mainCategory, setMainCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [applyToSimilar, setApplyToSimilar] = useState(false)
  const [similarPreviewCount, setSimilarPreviewCount] = useState(0)
  const [loadingSimilarPreview, setLoadingSimilarPreview] = useState(false)

  const [categorySchema, setCategorySchema] = useState([])
  const [subcategoryMap, setSubcategoryMap] = useState(FALLBACK_SUBCATEGORY_MAP)

  const [selectedTransactionIds, setSelectedTransactionIds] = useState([])
  const [isBulkEditMode, setIsBulkEditMode] = useState(false)

  const isSingleEditMode = Boolean(selectedTransaction)
  const isAnyEditModalOpen = isSingleEditMode || isBulkEditMode

  const schemaColorMap = categorySchema.reduce((acc, item) => {
    acc[item.key] = item.color
    return acc
  }, {})

  const getCategoryColor = (category) => {
    if (!category) return '#71717a'
    return schemaColorMap[category] || '#71717a'
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
    async function fetchCategorySchema() {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/categories/schema')

        if (!response.ok) {
          throw new Error('Erro ao buscar schema de categorias')
        }

        const data = await response.json()
        const categories = data.categories || []

        setCategorySchema(categories)

        const nextSubcategoryMap = categories.reduce((accumulator, item) => {
          accumulator[item.key] = (item.subcategories || []).map(
            (subcategory) => subcategory.key
          )
          return accumulator
        }, {})


        setSubcategoryMap(
          Object.keys(nextSubcategoryMap).length
            ? nextSubcategoryMap
            : FALLBACK_SUBCATEGORY_MAP
        )
      } catch (err) {
        console.error(err)

        setSubcategoryMap(FALLBACK_SUBCATEGORY_MAP)
      }
    }

    fetchCategorySchema()
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [filters, pagination])

  async function fetchTransactions(showLoader = true) {
    try {
      if (showLoader) {
        setLoading(true)
      }
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
      if (showLoader) {
        setLoading(false)
      }
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

  function toggleTransactionSelection(transactionId) {
    setSelectedTransactionIds((prev) =>
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId]
    )
  }

  function toggleSelectAllCurrentPage() {
    const currentPageIds = transactions.map((transaction) => transaction.id)

    const allSelected = currentPageIds.every((id) =>
      selectedTransactionIds.includes(id)
    )

    if (allSelected) {
      setSelectedTransactionIds((prev) =>
        prev.filter((id) => !currentPageIds.includes(id))
      )
      return
    }

    setSelectedTransactionIds((prev) => [
      ...new Set([...prev, ...currentPageIds]),
    ])
  }

  function resetEditForm() {
    setUserNote('')
    setMainCategory('')
    setSubcategory('')
    setApplyToSimilar(false)
    setSimilarPreviewCount(0)
    setLoadingSimilarPreview(false)
    setFormError('')
  }

  function openBulkEditModal() {
    setSelectedTransaction(null)
    setSuccessMessage('')
    setFormError('')
    resetEditForm()
    setIsBulkEditMode(true)
  }

  function closeBulkEditModal() {
    setIsBulkEditMode(false)
    setSelectedTransaction(null)
    resetEditForm()
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
    const resolvedMainCategory =
      transaction.main_category || 'nao_identificado'

    setSelectedTransaction(transaction)
    setSuccessMessage('')
    setFormError('')
    setUserNote(transaction.user_note || '')
    setMainCategory(resolvedMainCategory)
    setSubcategory(transaction.subcategory || '')
    setApplyToSimilar(false)
    setIsBulkEditMode(false)
  }

  function closeEditModal() {
    setSelectedTransaction(null)
    setIsBulkEditMode(false)
    resetEditForm()
  }

  async function fetchSimilarPreview(transactionId) {
    if (!transactionId) {
      setSimilarPreviewCount(0)
      return
    }

    try {
      setLoadingSimilarPreview(true)

      const response = await fetch(
        `http://127.0.0.1:8000/api/transactions/${transactionId}/similar-preview`
      )

      if (!response.ok) {
        throw new Error('Erro ao buscar prévia de transações semelhantes')
      }

      const data = await response.json()
      setSimilarPreviewCount(data.similar_count || 0)
    } catch (err) {
      setSimilarPreviewCount(0)
    } finally {
      setLoadingSimilarPreview(false)
    }
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (!isAnyEditModalOpen) return

      const tagName = event.target?.tagName?.toLowerCase()
      const isTextArea = tagName === 'textarea'
      const isInput = tagName === 'input'
      const isSelect = tagName === 'select'

      if (event.key === 'Escape') {
        event.preventDefault()
        closeEditModal()
        return
      }

      if (event.key === 'Enter' && !isTextArea) {
        event.preventDefault()

        if (isBulkEditMode) {
          saveBulkCategory()
          return
        }

        if (selectedTransaction) {
          saveCategory()
        }
      }

      if (event.key === 'Enter' && isInput && !selectedTransaction && !isBulkEditMode) {
        event.preventDefault()
      }

      if (event.key === 'Enter' && isSelect) {
        event.preventDefault()

        if (isBulkEditMode) {
          saveBulkCategory()
          return
        }

        if (selectedTransaction) {
          saveCategory()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAnyEditModalOpen, isBulkEditMode, selectedTransaction, mainCategory, subcategory, userNote])

  async function saveCategory() {
    if (!selectedTransaction) {
      return
    }

    if (!mainCategory) {
      setFormError('Selecione uma categoria principal.')
      return
    }

    if (!subcategory) {
      setFormError('Selecione uma subcategoria.')
      return
    }

    try {
      setSavingId(selectedTransaction.id)
      setError('')
      setFormError('')

      const response = await fetch(
        `http://127.0.0.1:8000/api/transactions/${selectedTransaction.id}/category`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            main_category: mainCategory,
            subcategory: subcategory,
            display_description: selectedTransaction.display_description,
            user_note: userNote || null,
            apply_to_similar: applyToSimilar,
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

      if (updatedData.similar_updated_count > 0) {
        setSuccessMessage(
          `Categoria atualizada. Aplicado em ${updatedData.similar_updated_count} transações semelhantes.`
        )
      } else {
        setSuccessMessage('Categoria atualizada com sucesso.')
      }

      closeEditModal()
      await fetchTransactions(false)
    } catch (err) {
      setFormError(err.message || 'Erro ao salvar categoria')
    } finally {
      setSavingId(null)
    }
  }

  async function saveBulkCategory() {
    if (!selectedTransactionIds.length) {
      setFormError('Selecione pelo menos uma transação.')
      return
    }

    if (!mainCategory) {
      setFormError('Selecione uma categoria principal.')
      return
    }

    if (!subcategory) {
      setFormError('Selecione uma subcategoria.')
      return
    }

    try {
      setError('')
      setFormError('')

      const response = await fetch(
        'http://127.0.0.1:8000/api/transactions/bulk-category',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transaction_ids: selectedTransactionIds,
            main_category: mainCategory || null,
            subcategory: subcategory || null,
            user_note: userNote || null,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Erro ao atualizar transações em lote')
      }

      const updatedData = await response.json()

      if (!updatedData.success) {
        throw new Error(
          updatedData.message || 'Erro ao atualizar transações em lote'
        )
      }

      setSuccessMessage('Transações atualizadas com sucesso.')
      closeBulkEditModal()
      setSelectedTransactionIds([])
      await fetchTransactions(false)
    } catch (err) {
      setFormError(err.message || 'Erro ao salvar edição em lote')
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
    <div className="container transactions-page">
      <header className="header transactions-header">
        <div className="transactions-header-top">
          <div>
            <h1>Transações</h1>
            <p>Visualize, filtre, importe arquivos e revise categorias</p>
          </div>

          <Link
            to="/"
            className="back-link-button"
          >
            ← Voltar para dashboard
          </Link>
        </div>
      </header>

      <section className="transactions-toolbar-card">
        <div className="transactions-toolbar-left">
          <button
            className="filter-button"
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? 'Ocultar importação' : 'Importar arquivos'}
          </button>

          <button
            className="secondary-button"
            onClick={openBulkEditModal}
            disabled={!selectedTransactionIds.length}
          >
            Editar selecionadas ({selectedTransactionIds.length})
          </button>
        </div>

        <div className="transactions-toolbar-right">
          <span className="transactions-total-pill">
            Total encontrado: {total}
          </span>
        </div>
      </section>

      {showUpload && (
        <section className="table-container transactions-upload-card">
          <div className="transactions-section-header">
            <div>
              <h2>Importar dados</h2>
              <p>Envie PDFs e CSVs para atualizar a base</p>
            </div>
          </div>

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
            <div className="transactions-upload-block">
              <h3 className="transactions-subtitle">
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
            <div className="transactions-upload-block">
              <h3 className="transactions-subtitle">
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

      {successMessage && (
        <div className="success-banner">
          {successMessage}
        </div>
      )}

      <section className="table-container transactions-filters-card">
        <div className="transactions-section-header">
          <div>
            <h2>Filtros</h2>
            <p>Refine a listagem sem sair da página</p>
          </div>
        </div>

        <div className="filters transactions-filters">
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
        </div>
      </section>

      <section className="table-container transactions-table-card">
        <div className="transactions-section-header transactions-table-header">
          <div>
            <h2>Lista de transações</h2>
            <p>Edite categorias direto pela tabela</p>
          </div>
        </div>

        <div className="transactions-table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="cell-center checkbox-cell">
                  <input
                    type="checkbox"
                    ref={(el) => {
                      if (el) {
                        el.indeterminate =
                          selectedTransactionIds.length > 0 &&
                          selectedTransactionIds.length < transactions.length
                      }
                    }}
                    checked={
                      transactions.length > 0 &&
                      transactions.every((transaction) =>
                        selectedTransactionIds.includes(transaction.id)
                      )
                    }
                    onChange={toggleSelectAllCurrentPage}
                  />
                </th>
                <th className="cell-center date-cell"><span>Data</span></th>
                <th className="cell-center transaction-description-cell"><span>Descrição</span></th>
                <th className="cell-center type-cell"><span>Tipo</span></th>
                <th className="cell-center origin-cell"><span>Origem</span></th>
                <th className="cell-center category-cell"><span>Categoria</span></th>
                <th className="cell-center subcategory-cell"><span>Subcategoria</span></th>
                <th className="cell-center source-cell"><span>Definição</span></th>
                <th className="cell-center value-cell"><span>Valor</span></th>
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
                    <td className="cell-center checkbox-cell">
                      <input
                        type="checkbox"
                        checked={selectedTransactionIds.includes(transaction.id)}
                        onChange={() => toggleTransactionSelection(transaction.id)}
                      />
                    </td>

                    <td className="cell-center date-cell">
                      {formatDate(transaction.transaction_date)}
                    </td>

                    <td className="cell-left transaction-description-cell">
                      <span
                        className={`transaction-description ${transaction.user_note ? 'has-note' : ''}`}
                        data-note={transaction.user_note || ''}
                      >
                        {transaction.display_description || transaction.raw_description}
                      </span>
                    </td>

                    <td className="cell-center type-cell">
                      {transactionTypeLabels[transaction.transaction_type] ||
                        transaction.transaction_type}
                    </td>

                    <td className="cell-center origin-cell">
                      {sourceLabels[transaction.source_type] || transaction.source_type}
                    </td>

                    <td className="cell-center category-cell">
                      <button
                        type="button"
                        onClick={() => openEditModal(transaction)}
                        className="category-badge category-trigger"
                        title="Clique para editar"
                        style={{
                          backgroundColor: getCategoryDisplayColor(
                            getCategoryColor(transaction.main_category),
                            0.15
                          ),
                          color: getCategoryColor(transaction.main_category),
                          fontWeight: 600,
                        }}
                      >
                        <span>
                          {formatCategoryLabel(transaction.main_category) || '-'}
                        </span>
                        <span className="category-chevron">˅</span>
                      </button>
                    </td>

                    <td className="cell-center subcategory-cell">
                      <span
                        className="category-badge"
                        style={{
                          backgroundColor: getCategoryDisplayColor(
                            getCategoryColor(transaction.main_category),
                            0.15
                          ),
                          color: getCategoryColor(transaction.main_category),
                          fontWeight: 600,
                        }}
                      >
                        {transaction.subcategory
                          ? formatCategoryLabel(transaction.subcategory)
                          : '-'}
                      </span>
                    </td>

                    <td className="cell-center source-cell">
                      <span
                        className={`source-badge ${transaction.category_source === 'manual'
                          ? 'source-manual'
                          : 'source-auto'
                          }`}
                      >
                        {transaction.category_source === 'manual' ? 'Manual' : 'Auto'}
                      </span>
                    </td>

                    <td
                      className={
                        transaction.direction === 'in'
                          ? 'green cell-left value-cell'
                          : 'red cell-left value-cell'
                      }
                    >
                      {transaction.direction === 'in' ? '+' : '-'}{' '}
                      {formatCurrency(transaction.absolute_amount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="pagination transactions-pagination">
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

      {isSingleEditMode && !isBulkEditMode && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Editar categoria</h2>

            <div className="modal-content">
              {formError && (
                <div className="modal-error-banner">
                  {formError}
                </div>
              )}
              <p>
                <strong>Descrição:</strong> {selectedTransaction.raw_description}
              </p>

              <p>
                <strong>Categoria atual:</strong>{' '}
                {formatCategoryLabel(selectedTransaction.main_category) || '-'}
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
                <option value="">Selecione</option>

                {categorySchema.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>

              <label className="modal-label">
                Subcategoria
              </label>

              <select
                className="modal-select"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                disabled={!mainCategory}
              >
                <option value="">Selecione</option>

                {(subcategoryMap[mainCategory] || []).map((sub) => (
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

              <label className="checkbox-filter">
                <input
                  type="checkbox"
                  checked={applyToSimilar}
                  onChange={async (e) => {
                    const checked = e.target.checked
                    setApplyToSimilar(checked)

                    if (checked && selectedTransaction?.id) {
                      await fetchSimilarPreview(selectedTransaction.id)
                    } else {
                      setSimilarPreviewCount(0)
                    }
                  }}
                />
                Aplicar para descrições semelhantes
              </label>


              {applyToSimilar && (
                <div className="similar-preview-banner">
                  {loadingSimilarPreview
                    ? 'Buscando transações semelhantes...'
                    : similarPreviewCount > 0
                      ? `Isso vai atualizar ${similarPreviewCount} transações semelhantes.`
                      : 'Nenhuma transação semelhante será atualizada.'}
                </div>
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
      {isBulkEditMode && (
        <div className="modal-overlay" onClick={closeBulkEditModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Editar transações em lote</h2>

            <div className="modal-content">
              {formError && (
                <div className="modal-error-banner">
                  {formError}
                </div>
              )}
              <p>
                <strong>Selecionadas:</strong> {selectedTransactionIds.length}
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
                <option value="">Selecione</option>

                {categorySchema.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>

              <label className="modal-label">
                Subcategoria
              </label>

              <select
                className="modal-select"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                disabled={!mainCategory}
              >
                <option value="">Selecione</option>

                {(subcategoryMap[mainCategory] || []).map((sub) => (
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
                placeholder="Opcional"
              />
            </div>

            <div className="modal-actions">
              <button
                className="filter-button"
                onClick={saveBulkCategory}
              >
                Salvar em lote
              </button>

              <button className="secondary-button" onClick={closeBulkEditModal}>
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