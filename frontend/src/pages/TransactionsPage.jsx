import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCategoryDisplayColor } from '../utils/categoryStyle'
import PageLoader from '../components/PageLoader'
import { authFetch } from '../lib/authFetch'


const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'



const FALLBACK_SUBCATEGORY_MAP = {
  nao_identificado: ['nao_identificado'],
}

const COLOR_PRESETS = [
  '#8b5cf6', // roxo base
  '#a78bfa',
  '#c084fc',
  '#e879f9',
  '#f472b6',
  '#fb7185',
  '#f97316',
  '#facc15',
  '#4ade80',
  '#22c55e',
  '#38bdf8',
  '#60a5fa',
]



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
  const hasLoadedTransactionsRef = useRef(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState(null)
  const [formError, setFormError] = useState('')
  const [total, setTotal] = useState(0)
  const [savingId, setSavingId] = useState(null)


  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadResults, setUploadResults] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [resetting, setResetting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  const [filters, setFilters] = useState({
    month: '',
    type: '',
    source: '',
    main_category: '',
    subcategory: '',
    category_source: '',
    reviewed: '',
    pending_review: '',
  })

  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
  })

  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [userNote, setUserNote] = useState('')
  const [mainCategory, setMainCategory] = useState('')
  const [selectedCategoryColor, setSelectedCategoryColor] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [applyToSimilar, setApplyToSimilar] = useState(false)
  const [similarPreviewCount, setSimilarPreviewCount] = useState(0)
  const [loadingSimilarPreview, setLoadingSimilarPreview] = useState(false)

  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [loadingAiSuggestion, setLoadingAiSuggestion] = useState(false)
  const [aiSuggestionError, setAiSuggestionError] = useState('')

  const [categorySchema, setCategorySchema] = useState([])
  const [activeColorPicker, setActiveColorPicker] = useState(null)
  const [subcategoryMap, setSubcategoryMap] = useState(FALLBACK_SUBCATEGORY_MAP)

  // criação de categoria
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#a78bfa')
  const [creatingCategory, setCreatingCategory] = useState(false)

  // criação de subcategoria
  const [showCreateSubcategory, setShowCreateSubcategory] = useState(false)
  const [newSubcategoryLabel, setNewSubcategoryLabel] = useState('')
  const [creatingSubcategory, setCreatingSubcategory] = useState(false)

  const [selectedTransactionIds, setSelectedTransactionIds] = useState([])
  const [isBulkEditMode, setIsBulkEditMode] = useState(false)

  const [isCreateManualModalOpen, setIsCreateManualModalOpen] = useState(false)
  const [creatingManualTransaction, setCreatingManualTransaction] = useState(false)

  const [manualTransactionForm, setManualTransactionForm] = useState({
    transaction_date: '',
    description: '',
    amount: '',
    amountDisplay: '',
    direction: 'out',
    transaction_type: 'purchase',
    main_category: '',
    subcategory: '',
    source_name: '',
    source_type: 'bank_account',
  })

  const isSingleEditMode = Boolean(selectedTransaction)
  const isAnyEditModalOpen =
    isSingleEditMode || isBulkEditMode || isCreateManualModalOpen

  const schemaColorMap = categorySchema.reduce((acc, item) => {
    acc[item.key] = item.color
    return acc
  }, {})

  const categoryLabelMap = categorySchema.reduce((acc, item) => {
    acc[item.key] = item.label
    return acc
  }, {})

  const getCategoryDisplayLabel = (categoryKey) => {
    if (!categoryKey) return ''
    return categoryLabelMap[categoryKey] || formatCategoryLabel(categoryKey)
  }

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
        const response = await authFetch('/api/transactions/months')

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


  async function reloadCategorySchema() {
    const response = await fetch(`${API_BASE_URL}/api/categories/schema`)

    if (!response.ok) {
      throw new Error('Erro ao atualizar categorias')
    }

    const data = await response.json()
    const categories = data.categories || []

    setCategorySchema(categories)

    const nextSubcategoryMap = categories.reduce((acc, item) => {
      acc[item.key] = (item.subcategories || []).map((s) => s.key)
      return acc
    }, {})

    setSubcategoryMap(
      Object.keys(nextSubcategoryMap).length
        ? nextSubcategoryMap
        : FALLBACK_SUBCATEGORY_MAP
    )
  }

  async function updateCategoryColor(categoryKey, color) {
    try {
      const response = await authFetch(`/api/categories/${categoryKey}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ color }),
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar cor')
      }

      await reloadCategorySchema()
    } catch (err) {
      console.error(err)
    }
  }

  async function handleCreateCategory() {
    if (!newCategoryLabel.trim()) {
      setFormError('Informe um nome para a categoria')
      return
    }

    try {
      setCreatingCategory(true)
      setFormError('')

      const response = await authFetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label: newCategoryLabel,
          color: newCategoryColor,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao criar categoria')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Erro ao criar categoria')
      }

      await reloadCategorySchema()

      setMainCategory(data.key)
      setSubcategory('')
      setNewCategoryLabel('')
      setNewCategoryColor('#a78bfa')
      setShowCreateCategory(false)
      setShowCreateSubcategory(true)

    } catch (err) {
      setFormError(err.message || 'Erro ao criar categoria')
    } finally {
      setCreatingCategory(false)
    }
  }

  async function handleCreateSubcategory() {
    if (!mainCategory) {
      setFormError('Selecione primeiro uma categoria principal')
      return
    }

    if (!newSubcategoryLabel.trim()) {
      setFormError('Informe um nome para a subcategoria')
      return
    }

    try {
      setCreatingSubcategory(true)
      setFormError('')

      const response = await authFetch(`/api/categories/${mainCategory}/subcategories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label: newSubcategoryLabel,
        }),
      }
      )

      if (!response.ok) {
        throw new Error('Erro ao criar subcategoria')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Erro ao criar subcategoria')
      }

      await reloadCategorySchema()

      setSubcategory(data.key)
      setNewSubcategoryLabel('')
      setShowCreateSubcategory(false)
    } catch (err) {
      setFormError(err.message || 'Erro ao criar subcategoria')
    } finally {
      setCreatingSubcategory(false)
    }
  }



  useEffect(() => {
    async function loadSchema() {
      try {
        await reloadCategorySchema()
      } catch (err) {
        console.error(err)
        setSubcategoryMap(FALLBACK_SUBCATEGORY_MAP)
      }
    }

    loadSchema()
  }, [])

  useEffect(() => {
    if (!hasLoadedTransactionsRef.current) {
      fetchTransactions(true)
      hasLoadedTransactionsRef.current = true
      return
    }

    fetchTransactions(false)
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

      if (filters.main_category) {
        queryParams.append('main_category', filters.main_category)
      }

      if (filters.subcategory) {
        queryParams.append('subcategory', filters.subcategory)
      }

      if (filters.category_source) {
        queryParams.append('category_source', filters.category_source)
      }

      if (filters.reviewed !== '') {
        queryParams.append('reviewed', filters.reviewed)
      }

      if (filters.pending_review !== '') {
        queryParams.append('pending_review', filters.pending_review)
      }

      queryParams.append('limit', String(pagination.limit))
      queryParams.append('offset', String(pagination.offset))

      const response = await authFetch(
        `/api/transactions?${queryParams.toString()}`
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

  function handleClearFilters() {
    setFilters({
      month: '',
      type: '',
      source: '',
      main_category: '',
      subcategory: '',
      category_source: '',
      reviewed: '',
      pending_review: '',
    })

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

    let interval = null

    try {
      setUploading(true)
      setError('')
      setUploadProgress(8)

      interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 92) return prev

          const nextValue = prev + Math.random() * 18
          return Math.min(nextValue, 92)
        })
      }, 220)

      const formData = new FormData()

      selectedFiles.forEach((file) => {
        formData.append('files', file)
      })

      const response = await authFetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Erro ao enviar arquivos')
      }

      setUploadProgress(100)

      const data = await response.json()
      setUploadResults(data.results || [])
      setSelectedFiles([])

      const monthsResponse = await authFetch('/api/transactions/months')

      if (monthsResponse.ok) {
        const monthsData = await monthsResponse.json()
        setMonths(monthsData.months || [])
      }

      await fetchTransactions(false)

      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (err) {
      setError(err.message || 'Erro ao enviar arquivos')
    } finally {
      if (interval) {
        clearInterval(interval)
      }

      setUploading(false)
      setUploadProgress(0)
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

    setShowCreateCategory(false)
    setNewCategoryLabel('')
    setNewCategoryColor('#a78bfa')
    setCreatingCategory(false)

    setShowCreateSubcategory(false)
    setNewSubcategoryLabel('')
    setCreatingSubcategory(false)

    setAiSuggestion(null)
    setLoadingAiSuggestion(false)
    setAiSuggestionError('')
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

      const response = await authFetch('/api/dev/reset', {
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
        main_category: '',
        subcategory: '',
        category_source: '',
        reviewed: '',
        pending_review: '',
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

  function formatCurrencyInput(value) {
    const numeric = value.replace(/\D/g, '')

    const number = Number(numeric) / 100

    return number.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function formatFileSize(sizeInBytes) {
    if (!sizeInBytes) return '0 KB'

    const kb = sizeInBytes / 1024

    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`
    }

    const mb = kb / 1024
    return `${mb.toFixed(2)} MB`
  }

  function openEditModal(transaction) {
    const resolvedMainCategory =
      transaction.main_category || 'nao_identificado'

    setSelectedTransaction(transaction)
    setSuccessMessage('')
    setFormError('')
    setUserNote(transaction.user_note || '')
    setMainCategory(resolvedMainCategory)
    setSelectedCategoryColor(getCategoryColor(resolvedMainCategory))
    setSubcategory(transaction.subcategory || '')
    setApplyToSimilar(false)
    setIsBulkEditMode(false)

    setAiSuggestion(null)
    setAiSuggestionError('')
    fetchAiSuggestion(transaction.raw_description)
  }

  function closeEditModal() {
    setSelectedTransaction(null)
    setIsBulkEditMode(false)
    resetEditForm()
  }

  function resetManualTransactionForm() {
    setManualTransactionForm({
      transaction_date: '',
      description: '',
      amount: '',
      amountDisplay: '',
      direction: 'out',
      transaction_type: 'purchase',
      main_category: '',
      subcategory: '',
      source_name: '',
      source_type: 'bank_account',
    })
  }

  function openCreateManualModal() {
    setSelectedTransaction(null)
    setIsBulkEditMode(false)
    setSuccessMessage('')
    setFormError('')
    resetEditForm()
    resetManualTransactionForm()
    setIsCreateManualModalOpen(true)
  }

  function closeCreateManualModal() {
    setIsCreateManualModalOpen(false)
    setFormError('')
    resetManualTransactionForm()
  }

  function handleManualTransactionChange(field, value) {
    setManualTransactionForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      }

      if (field === 'amount') {
        const numeric = value.replace(/\D/g, '')
        const number = Number(numeric) / 100

        next.amount = number
        next.amountDisplay = number.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })

        return next
      }

      if (field === 'direction') {
        if (value === 'in') {
          next.transaction_type = 'transfer_in'
          next.main_category = ''
          next.subcategory = ''
          next.source_type = 'bank_account'
        }

        if (value === 'out') {
          next.transaction_type = 'purchase'
        }
      }

      if (field === 'transaction_type') {
        if (value === 'pix_in' || value === 'transfer_in') {
          next.direction = 'in'
          next.main_category = ''
          next.subcategory = ''
          next.source_type = 'bank_account'
        }

        if (
          value === 'purchase' ||
          value === 'pix_out' ||
          value === 'transfer_out' ||
          value === 'bill_payment' ||
          value === 'bank_transaction'
        ) {
          next.direction = 'out'
        }
      }

      if (field === 'main_category') {
        next.subcategory = ''
      }

      return next
    })
  }

  async function saveManualTransaction() {
    const {
      transaction_date,
      description,
      amount,
      direction,
      transaction_type,
      main_category,
      subcategory,
      source_name,
      source_type,
    } = manualTransactionForm

    if (!transaction_date || !description.trim() || amount === '') {
      setFormError('Preencha data, descrição e valor.')
      return
    }

    if (!source_name.trim()) {
      setFormError('Informe a instituição / fonte da transação.')
      return
    }

    if (direction === 'out' && (!main_category || !subcategory)) {
      setFormError('Selecione categoria e subcategoria para a saída.')
      return
    }

    try {
      setCreatingManualTransaction(true)
      setFormError('')
      setError('')

      const numericAmount = Number(amount)

      if (Number.isNaN(numericAmount) || numericAmount === 0) {
        setFormError('Informe um valor válido.')
        return
      }

      const finalAmount =
        direction === 'out' ? -Math.abs(numericAmount) : Math.abs(numericAmount)

      const response = await authFetch(
        '/api/transactions/manual',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transaction_date,
            description: description.trim(),
            amount: finalAmount,
            direction,
            transaction_type,
            main_category: direction === 'in' ? '' : main_category,
            subcategory: direction === 'in' ? '' : subcategory,
            source_name: source_name.trim().toLowerCase(),
            source_type,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Erro ao criar transação manual')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Erro ao criar transação manual')
      }

      setSuccessMessage({
        title: 'Transação criada',
        description: 'A transação manual foi adicionada com sucesso.',
        tone: 'success',
      })

      closeCreateManualModal()
      await fetchTransactions(false)

      const monthsResponse = await authFetch('/api/transactions/months')

      if (monthsResponse.ok) {
        const monthsData = await monthsResponse.json()
        setMonths(monthsData.months || [])
      }
    } catch (err) {
      setFormError(err.message || 'Erro ao criar transação manual')
    } finally {
      setCreatingManualTransaction(false)
    }
  }

  async function fetchSimilarPreview(transactionId) {
    if (!transactionId) {
      setSimilarPreviewCount(0)
      return
    }

    try {
      setLoadingSimilarPreview(true)

      const response = await authFetch(
        `/api/transactions/${transactionId}/similar-preview`
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

  async function fetchAiSuggestion(description) {
    if (!description) {
      setAiSuggestion(null)
      return
    }

    try {
      setLoadingAiSuggestion(true)
      setAiSuggestionError('')
      setAiSuggestion(null)

      const response = await authFetch(
        '/api/ai/suggest-category',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Erro ao buscar sugestão da IA')
      }

      const data = await response.json()

      if (!data.success || !data.result) {
        throw new Error(data.message || 'Sugestão da IA indisponível')
      }

      setAiSuggestion(data.result)
    } catch (err) {
      setAiSuggestion(null)
      setAiSuggestionError(err.message || 'Erro ao buscar sugestão da IA')
    } finally {
      setLoadingAiSuggestion(false)
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

        if (isCreateManualModalOpen) {
          closeCreateManualModal()
          return
        }

        closeEditModal()
        return
      }

      if (event.key === 'Enter' && !isTextArea) {
        event.preventDefault()

        if (isCreateManualModalOpen) {
          saveManualTransaction()
          return
        }

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

        if (isCreateManualModalOpen) {
          saveManualTransaction()
          return
        }

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


  function applyAiSuggestion() {
    if (!aiSuggestion) {
      return
    }

    setMainCategory(aiSuggestion.category_key || '')
    setSubcategory(aiSuggestion.subcategory_key || '')
    setFormError('')
  }

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

      const response = await authFetch(
        `/api/transactions/${selectedTransaction.id}/category`,
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
        setSuccessMessage({
          title: 'Categoria atualizada',
          description: `Aplicado em ${updatedData.similar_updated_count} transações semelhantes.`,
          tone: 'success',
        })
      } else {
        setSuccessMessage({
          title: 'Categoria atualizada',
          description: 'A transação foi atualizada com sucesso.',
          tone: 'success',
        })
      }

      await updateCategoryColor(mainCategory, selectedCategoryColor)


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

      const response = await authFetch(
        '/api/transactions/bulk-category',
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

      setSuccessMessage({
        title: 'Transações atualizadas',
        description: `${updatedData.updated_count} transação${updatedData.updated_count !== 1 ? 'ões foram' : ' foi'} atualizada${updatedData.updated_count !== 1 ? 's' : ''} com sucesso.`,
        tone: 'success',
      })
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

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter((value) => value !== '').length
  }, [filters])

  const selectedFilesSize = useMemo(() => {
    return selectedFiles.reduce((totalSize, file) => totalSize + file.size, 0)
  }, [selectedFiles])

  const uploadSuccessCount = useMemo(() => {
    return uploadResults.filter((result) => !result.error).length
  }, [uploadResults])

  const uploadErrorCount = useMemo(() => {
    return uploadResults.filter((result) => Boolean(result.error)).length
  }, [uploadResults])

  if (loading) return <PageLoader />

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
          <div className="transactions-header-main">
            <h1>Transações</h1>
            <p>Visualize, filtre, importe arquivos e revise categorias</p>

            <div className="transactions-header-link">
              <Link
                to="/"
                className="back-link-button"
              >
                ← Voltar para dashboard
              </Link>
            </div>
          </div>
        </header>

        <section className="transactions-toolbar-card">
          <div className="transactions-toolbar-center">
            <button
              type="button"
              className="toolbar-pill-button is-active"
              onClick={openCreateManualModal}
            >
              Nova transação
            </button>

            <button
              type="button"
              className={`toolbar-pill-button ${showUpload ? 'is-active' : ''}`}
              onClick={() => setShowUpload((prev) => !prev)}
            >
              {showUpload ? 'Ocultar importação' : 'Importar arquivos'}
            </button>

            <button
              type="button"
              className={`toolbar-pill-button ${showFilters ? 'is-active' : ''}`}
              onClick={() => setShowFilters((prev) => !prev)}
            >
              {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
            </button>

            <button
              type="button"
              className="toolbar-pill-button is-muted"
              onClick={openBulkEditModal}
              disabled={!selectedTransactionIds.length}
            >
              Editar selecionadas ({selectedTransactionIds.length})
            </button>
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

            <div className="upload-overview-grid">
              <div className="upload-overview-card">
                <span className="upload-overview-label">Arquivos prontos</span>
                <strong className="upload-overview-value">{selectedFiles.length}</strong>
                <small className="upload-overview-helper">
                  {selectedFiles.length
                    ? formatFileSize(selectedFilesSize)
                    : 'Nenhum arquivo selecionado'}
                </small>
              </div>

              <div className="upload-overview-card">
                <span className="upload-overview-label">Importações ok</span>
                <strong className="upload-overview-value">{uploadSuccessCount}</strong>
                <small className="upload-overview-helper">
                  Arquivos processados sem erro
                </small>
              </div>

              <div className="upload-overview-card">
                <span className="upload-overview-label">Com erro</span>
                <strong className="upload-overview-value">{uploadErrorCount}</strong>
                <small className="upload-overview-helper">
                  Arquivos que precisam revisão
                </small>
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
              <div className="upload-dropzone-inner">
                <p className="upload-title">Arraste seus arquivos aqui</p>

                <p className="upload-subtitle">
                  PDFs e CSVs • múltiplos arquivos por vez • ideal para faturas e extratos
                </p>

                <div className="upload-status-line">
                  {selectedFiles.length > 0 ? (
                    <span>
                      {selectedFiles.length} arquivo{selectedFiles.length > 1 ? 's' : ''} selecionado{selectedFiles.length > 1 ? 's' : ''} • {formatFileSize(selectedFilesSize)}
                    </span>
                  ) : (
                    <span>Nenhum arquivo selecionado ainda</span>
                  )}
                </div>

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
                    {uploading ? 'Enviando arquivos...' : 'Iniciar importação'}
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    disabled={!selectedFiles.length || uploading}
                  >
                    Limpar seleção
                  </button>

                  <button
                    className="secondary-button"
                    onClick={handleResetDatabase}
                    disabled={resetting}
                  >
                    {resetting ? 'Limpando base...' : 'Limpar base'}
                  </button>



                </div>

                {uploading && (
                  <div className="upload-progress">
                    <div
                      className="upload-progress-bar"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}

              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="transactions-upload-block">
                <div className="upload-block-header">
                  <h3 className="transactions-subtitle">
                    Arquivos selecionados ({selectedFiles.length})
                  </h3>
                </div>

                <div className="upload-file-list">
                  {selectedFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="upload-file-item"
                    >
                      <div className="upload-file-main">
                        <span className="upload-file-name">{file.name}</span>
                        <span className="upload-file-meta">
                          {file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'CSV'}
                        </span>
                      </div>

                      <strong className="upload-file-size">
                        {formatFileSize(file.size)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadResults.length > 0 && (
              <div className="transactions-upload-block">
                <div className="upload-block-header">
                  <h3 className="transactions-subtitle">Resultado da importação</h3>
                </div>

                <div className="upload-result-list">
                  {uploadResults.map((result, index) => {
                    const hasError = Boolean(result.error)

                    return (
                      <div
                        key={`${result.filename}-${index}`}
                        className={`upload-result-item ${hasError ? 'is-error' : 'is-success'}`}
                      >
                        <div className="upload-result-main">
                          <span className="upload-result-name">
                            {result.original_filename || result.filename}
                          </span>

                          <span className="upload-result-status">
                            {hasError ? 'Erro na importação' : 'Importação concluída'}
                          </span>
                        </div>

                        <strong className="upload-result-summary">
                          {hasError
                            ? result.error
                            : `Inseridas: ${result.inserted_count ?? 0} • Ignoradas: ${result.skipped_count ?? 0}`}
                        </strong>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}



        {showFilters && (
          <section className="table-container transactions-filters-card">
            <div className="transactions-section-header transactions-filters-header">
              <div className="transactions-filters-title-row">
                <span className="filters-title-line"></span>
                <h2 className="filters-title-with-icon">
                  <span className="filters-icon">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M4 6H20"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M7 11H17"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M10 15H14"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M11.2 18.2C11.2 17.76 11.56 17.4 12 17.4C12.44 17.4 12.8 17.76 12.8 18.2C12.8 18.64 12.44 19 12 19C11.56 19 11.2 18.64 11.2 18.2Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                  Filtros
                </h2>
                <span className="filters-title-line"></span>
              </div>

              <p>Refine a listagem sem sair da página</p>
            </div>

            <div className="filters transactions-filters">
              <div className="transactions-filters-grid">
                {/* Mês */}
                <div className="filter-item">
                  <label>Mês</label>
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
                </div>

                {/* Tipo */}
                <div className="filter-item">
                  <label>Tipo de transação</label>
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
                </div>

                {/* Origem */}
                <div className="filter-item">
                  <label>Origem</label>
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

                {/* Categoria principal */}
                <div className="filter-item">
                  <label>Categoria principal</label>
                  <select
                    value={filters.main_category}
                    onChange={(e) => {
                      const nextMainCategory = e.target.value

                      setFilters((prev) => ({
                        ...prev,
                        main_category: nextMainCategory,
                        subcategory: '',
                      }))

                      setPagination((prev) => ({
                        ...prev,
                        offset: 0,
                      }))
                    }}
                  >
                    <option value="">Todas as categorias</option>
                    {categorySchema.map((category) => (
                      <option key={category.key} value={category.key}>
                        {category.label}
                      </option>
                    ))}
                  </select>

                </div>

                {/* Subcategoria */}
                <div className="filter-item">
                  <label>Subcategoria</label>
                  <select
                    value={filters.subcategory}
                    onChange={(e) => handleFilterChange('subcategory', e.target.value)}
                    disabled={!filters.main_category}
                  >
                    <option value="">Todas as subcategorias</option>
                    {(subcategoryMap[filters.main_category] || []).map((sub) => (
                      <option key={sub} value={sub}>
                        {formatCategoryLabel(sub)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Definição */}
                <div className="filter-item">
                  <label>Definição</label>
                  <select
                    value={filters.category_source}
                    onChange={(e) => handleFilterChange('category_source', e.target.value)}
                  >
                    <option value="">Todas as definições</option>
                    <option value="manual">Manual</option>
                    <option value="rule">Auto</option>
                  </select>
                </div>

                {/* Revisão */}
                <div className="filter-item">
                  <label>Revisão</label>
                  <select
                    value={filters.reviewed}
                    onChange={(e) => handleFilterChange('reviewed', e.target.value)}
                  >
                    <option value="">Toda revisão</option>
                    <option value="1">Revisadas</option>
                    <option value="0">Não revisadas</option>
                  </select>
                </div>

                {/* Pendências */}
                <div className="filter-item">
                  <label>Pendências</label>
                  <select
                    value={filters.pending_review}
                    onChange={(e) => handleFilterChange('pending_review', e.target.value)}
                  >
                    <option value="">Sem pendências</option>
                    <option value="1">Pendências de categorização</option>
                  </select>
                </div>
              </div>

              <div className="transactions-filters-actions">
                <button
                  type="button"
                  className="secondary-button transactions-clear-filters-button"
                  onClick={handleClearFilters}
                  disabled={activeFiltersCount === 0}
                >
                  <span className="clear-icon">↻</span>
                  Limpar filtros
                </button>

                <div className="transactions-filters-summary">
                  <span className="info-icon">ⓘ</span>
                  {activeFiltersCount} filtro{activeFiltersCount !== 1 ? 's' : ''} ativo{activeFiltersCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </section>
        )}
        {successMessage && (
          <div className={`success-banner success-banner-${successMessage.tone || 'success'}`}>
            <div className="success-banner-content">
              <div className="success-banner-title-row">
                <span className="success-inline-icon">✓</span>
                <strong>{successMessage.title}</strong>
              </div>

              <span>{successMessage.description}</span>
            </div>

            <button
              type="button"
              className="success-banner-close"
              onClick={() => setSuccessMessage(null)}
              aria-label="Fechar aviso"
            >
              ✕
            </button>
          </div>
        )}

        <section className="table-container transactions-table-card">
          <div className="transactions-section-header transactions-table-header">
            <div className="transactions-table-header-left">
              <h2>Lista de transações</h2>
              <p>Edite categorias direto pela tabela</p>
            </div>

            <div className="transactions-table-header-right">
              <span className="transactions-total-pill">
                Total encontrado: {total}
              </span>
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
                        <div className="category-color-wrapper">
                          <div
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
                              {getCategoryDisplayLabel(transaction.main_category) || '-'}
                            </span>
                            <span className="category-chevron">˅</span>


                          </div>


                        </div>
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



              <div className="modal-meta-card">
                <div className="modal-meta-row">
                  <span className="modal-meta-label">Atual</span>
                  <span className="modal-meta-value">
                    {getCategoryDisplayLabel(selectedTransaction.main_category) || '-'}
                  </span>
                </div>



                <div className="modal-meta-row">
                  <span className="modal-meta-label">Origem</span>
                  <span className="modal-meta-value">
                    {selectedTransaction.category_source === 'manual' ? 'Manual' : 'Automática'}
                  </span>
                </div>

                <div className="modal-meta-description">
                  <span className="modal-meta-label">Descrição</span>
                  <span className="modal-meta-description-text">
                    {selectedTransaction.raw_description}
                  </span>
                </div>
              </div>

              <div className="ai-suggestion-card">
                <div className="ai-suggestion-header">
                  <strong>🤖 Sugestão da IA</strong>


                </div>

                {loadingAiSuggestion && (
                  <p className="ai-suggestion-status">Analisando transação...</p>
                )}

                {!loadingAiSuggestion && aiSuggestionError && (
                  <p className="ai-suggestion-status ai-suggestion-status-error">
                    {aiSuggestionError}
                  </p>
                )}

                {!loadingAiSuggestion && aiSuggestion && (
                  <>
                    <div className="ai-suggestion-grid">
                      <div className="ai-suggestion-item">
                        <span className="ai-suggestion-label">Categoria</span>
                        <span className="ai-suggestion-value">
                          {getCategoryDisplayLabel(aiSuggestion.category_key)}
                        </span>
                      </div>

                      <div className="ai-suggestion-item">
                        <span className="ai-suggestion-label">Subcategoria</span>
                        <span className="ai-suggestion-value">
                          {formatCategoryLabel(aiSuggestion.subcategory_key)}
                        </span>
                      </div>

                      <div className="ai-suggestion-item">
                        <span className="ai-suggestion-label">Confiança</span>
                        <span className="ai-suggestion-value">
                          {aiSuggestion.confidence}
                        </span>
                      </div>
                    </div>

                    <p className="ai-suggestion-reason">
                      <span className="ai-suggestion-label">Motivo</span>
                      <span title={aiSuggestion.reason}>{aiSuggestion.reason}</span>
                    </p>
                    {!loadingAiSuggestion && aiSuggestion && (
                      <button
                        type="button"
                        className="inline-create-button ai-apply-button"
                        onClick={applyAiSuggestion}
                      >
                        Aplicar sugestão
                      </button>
                    )}
                  </>

                )}
              </div>

              <div className="modal-label-with-color">
                <label className="modal-label">
                  Categoria principal
                </label>

                <label className="category-color-picker-inline">
                  <input
                    type="color"
                    value={selectedCategoryColor}
                    onChange={(e) => setSelectedCategoryColor(e.target.value)}
                  />

                  <div
                    className="category-color-preview"
                    style={{ backgroundColor: selectedCategoryColor }}
                  />
                </label>
              </div>

              <div className="modal-select-row">
                <select
                  className="modal-select"
                  value={mainCategory}
                  onChange={(e) => {
                    const nextMainCategory = e.target.value
                    setMainCategory(nextMainCategory)
                    setSelectedCategoryColor(getCategoryColor(nextMainCategory))
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



                <button
                  type="button"
                  className="secondary-button modal-inline-side-button"
                  onClick={() => {
                    setShowCreateCategory((prev) => !prev)
                    setFormError('')
                  }}
                >
                  {showCreateCategory ? 'X Fechar' : '+ Nova'}
                </button>
              </div>



              {showCreateCategory && (
                <div className="modal-inline-section">
                  <div className="create-inline-form">
                    <input
                      type="text"
                      className="modal-input create-inline-input"
                      placeholder="Nome da categoria"
                      value={newCategoryLabel}
                      onChange={(e) => setNewCategoryLabel(e.target.value)}
                    />

                    <input
                      type="color"
                      className="create-inline-color"
                      value={newCategoryColor}
                      onChange={(e) => setNewCategoryColor(e.target.value)}
                      aria-label="Escolher cor da categoria"
                    />

                    <button
                      type="button"
                      className="inline-create-button"
                      onClick={handleCreateCategory}
                      disabled={creatingCategory}
                    >
                      {creatingCategory ? 'Criando...' : 'Criar categoria'}
                    </button>
                  </div>

                </div>
              )}

              <label className="modal-label">
                Subcategoria
              </label>

              <div className="modal-select-row">
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

                <button
                  type="button"
                  className="secondary-button modal-inline-side-button"
                  onClick={() => {
                    setShowCreateSubcategory((prev) => {
                      const nextValue = !prev

                      if (nextValue) {
                        setShowCreateCategory(false)
                        setNewCategoryLabel('')
                      }

                      return nextValue
                    })

                    setFormError('')
                  }}
                  disabled={!mainCategory}
                >
                  {showCreateSubcategory ? 'X Fechar' : '+ Nova'}
                </button>
              </div>

              {showCreateSubcategory && (
                <div className="modal-inline-section">
                  <div className="create-inline-form no-color">
                    <input
                      type="text"
                      className="modal-input create-inline-input"
                      placeholder="Nome da subcategoria"
                      value={newSubcategoryLabel}
                      onChange={(e) => setNewSubcategoryLabel(e.target.value)}
                    />

                    <button
                      type="button"
                      className="inline-create-button"
                      onClick={handleCreateSubcategory}
                      disabled={creatingSubcategory}
                    >
                      {creatingSubcategory ? 'Criando...' : 'Criar subcategoria'}
                    </button>
                  </div>
                </div>
              )}

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
                  setSelectedCategoryColor(getCategoryColor(nextMainCategory))
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

      {isCreateManualModalOpen && (
        <div className="modal-overlay" onClick={closeCreateManualModal}>
          <div
            className="category-modal manual-transaction-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="category-modal-header">
              <div>
                <h2>Nova transação manual</h2>
                <p>Adicione uma transação no mesmo padrão das importadas</p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeCreateManualModal}
              >
                ✕
              </button>
            </div>

            <div className="category-modal-body">
              <div className="manual-transaction-form-grid">
                <div className="form-field">
                  <label>Data</label>
                  <input
                    type="date"
                    value={manualTransactionForm.transaction_date}
                    onChange={(e) =>
                      handleManualTransactionChange('transaction_date', e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Valor</label>
                  <input
                    type="text"
                    value={manualTransactionForm.amountDisplay || ''}
                    onChange={(e) =>
                      handleManualTransactionChange('amount', e.target.value)
                    }
                    placeholder="R$ 0,00"
                    className="modal-input"
                  />
                </div>

                <div className="form-field form-field-full">
                  <label>Descrição</label>
                  <input
                    type="text"
                    placeholder="Ex.: Mercado, salário, pix recebido..."
                    value={manualTransactionForm.description}
                    onChange={(e) =>
                      handleManualTransactionChange('description', e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Direção</label>
                  <select
                    value={manualTransactionForm.direction}
                    onChange={(e) =>
                      handleManualTransactionChange('direction', e.target.value)
                    }
                  >
                    <option value="out">Saída</option>
                    <option value="in">Entrada</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Tipo</label>
                  <select
                    value={manualTransactionForm.transaction_type}
                    onChange={(e) =>
                      handleManualTransactionChange('transaction_type', e.target.value)
                    }
                  >
                    {manualTransactionForm.direction === 'out' ? (
                      <>
                        <option value="purchase">Compra</option>
                        <option value="pix_out">Pix Enviado</option>
                        <option value="transfer_out">Transferência Enviada</option>
                        <option value="bill_payment">Pagamento de Boleto</option>
                        <option value="bank_transaction">Movimentação Bancária</option>
                      </>
                    ) : (
                      <>
                        <option value="transfer_in">Salário / Transferência Recebida</option>
                        <option value="pix_in">Pix Recebido</option>
                      </>
                    )}
                  </select>
                </div>

                {manualTransactionForm.direction === 'out' && (
                  <>
                    <div className="form-field">
                      <label>Categoria principal</label>
                      <select
                        value={manualTransactionForm.main_category}
                        onChange={(e) =>
                          handleManualTransactionChange('main_category', e.target.value)
                        }
                      >

                        <option value="">Selecione</option>
                        {categorySchema.map((category) => (
                          <option key={category.key} value={category.key}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Subcategoria</label>
                      <select
                        value={manualTransactionForm.subcategory}
                        onChange={(e) =>
                          handleManualTransactionChange('subcategory', e.target.value)
                        }
                        disabled={!manualTransactionForm.main_category}
                      >
                        <option value="">Selecione</option>
                        {(subcategoryMap[manualTransactionForm.main_category] || []).map(
                          (subKey) => (
                            <option key={subKey} value={subKey}>
                              {formatCategoryLabel(subKey)}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                  </>
                )}

                <div className="form-field">
                  <label>Origem financeira</label>
                  <select
                    value={manualTransactionForm.source_type}
                    onChange={(e) =>
                      handleManualTransactionChange('source_type', e.target.value)
                    }
                  >
                    <option value="bank_account">Conta</option>
                    <option value="credit_card">Cartão</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Instituição / fonte</label>
                  <input
                    type="text"
                    placeholder="Ex.: nubank, inter, c6"
                    value={manualTransactionForm.source_name}
                    onChange={(e) =>
                      handleManualTransactionChange('source_name', e.target.value)
                    }
                  />
                </div>
              </div>

              {formError && <p className="form-error-message">{formError}</p>}
            </div>

            <div className="category-modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={closeCreateManualModal}
                disabled={creatingManualTransaction}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="filter-button"
                onClick={saveManualTransaction}
                disabled={creatingManualTransaction}
              >
                {creatingManualTransaction ? 'Salvando...' : 'Salvar transação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default TransactionsPage