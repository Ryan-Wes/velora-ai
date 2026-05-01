import { useEffect, useRef, useState } from 'react'
import PageLoader from './components/PageLoader'
import { generateInsights } from './utils/insights'
import logo from './assets/logo-full.png'

import { supabase } from './lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

import { authFetch } from './lib/authFetch'

import transactionsIcon from './assets/icons8-transacao.png'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
  LabelList,
} from 'recharts'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const ANIMATION = {
  fast: 450,
  normal: 700,
  slow: 900,
  easing: 'ease-out',
  delay: {
    kpi: 0,
    sparkline: 90,
    chart: 120,
    donut: 180,
    ai: 520,
    aiStep: 160,
  },
}


function Typewriter({ text, speed = 18, delay = 0 }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    let index = 0

    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplayed(text.slice(0, index + 1))
        index++

        if (index === text.length) {
          clearInterval(interval)
        }
      }, speed)

      return () => clearInterval(interval)
    }, delay)

    return () => clearTimeout(timeout)
  }, [text, speed, delay])

  return <span className="typewriter">{displayed}</span>
}


function KpiSparkline({ data, tone = 'positive' }) {
  const rawValues = data
    .map((value) => Number(value || 0))
    .filter((value) => Number.isFinite(value))

  if (rawValues.length < 2) return null

  const hasAnyValue = rawValues.some((value) => value > 0)
  if (!hasAnyValue) return null

  // Reduz diferença absurda entre valores grandes e pequenos.
  // Assim vários dias aparecem como "ondas", não só o maior pico.
  const compressedValues = rawValues.map((value) => {
    if (value <= 0) return 0
    return Math.sqrt(value)
  })

  const maxRaw = Math.max(...compressedValues) || 1

  // limita picos muito altos (tipo dia 1)
  const max = maxRaw * 0.7

  const normalizedValues = compressedValues.map((value, index) => {
    if (value <= 0) {
      // cria leve variação pra não ficar linha reta morta
      const noise = (Math.sin(index * 1.7) + 1) * 0.01
      return 0.12 + noise
    }

    const normalized = Math.min(value / max, 1)

    return 0.18 + normalized * 0.82
  })

  // Suavização: cria curvas entre dias com movimento.
  const smoothedValues = normalizedValues.map((value, index, array) => {
    const previous = array[index - 1] ?? value
    const next = array[index + 1] ?? value

    return previous * 0.22 + value * 0.56 + next * 0.22
  })

  const points = smoothedValues.map((value, index) => {
    const x = (index / (smoothedValues.length - 1)) * 100
    const y = 86 - value * 52

    return { x, y }
  })

  function buildSmoothPath(pointList) {
    let path = `M ${pointList[0].x} ${pointList[0].y}`

    for (let i = 1; i < pointList.length; i++) {
      const previous = pointList[i - 1]
      const current = pointList[i]
      const controlX = (previous.x + current.x) / 2

      path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`
    }

    return path
  }

  const path = buildSmoothPath(points)
  const areaPath = `${path} L 100 100 L 0 100 Z`
  const color = tone === 'negative' ? '#ec4899' : '#683dec'

  return (
    <svg
      className="kpi-sparkline"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`kpi-gradient-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="55%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>

        <filter id={`kpi-glow-${tone}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <line
        x1="0"
        y1="90"
        x2="100"
        y2="90"
        stroke={color}
        strokeOpacity="0.12"
        strokeWidth="1"
      />

      <path d={areaPath} fill={`url(#kpi-gradient-${tone})`} />

      <path
        key={path}
        className="kpi-sparkline-animated-line"
        style={{
          '--kpi-line-duration': `${ANIMATION.slow}ms`,
          '--kpi-line-delay': `${ANIMATION.delay.sparkline}ms`,
        }}
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#kpi-glow-${tone})`}
      />
    </svg>
  )
}



function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatCompactCurrency(value) {
  return Number(value || 0)
    .toLocaleString('pt-BR', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    })
    .replace('mil', ' mil')
    .replace('mi', ' mi')
}

function AnimatedNumber({
  value,
  duration = ANIMATION.normal,
  delay = ANIMATION.delay.kpi,
}) {
  const [displayValue, setDisplayValue] = useState(0)
  const currentValueRef = useRef(0)

  useEffect(() => {
    let animationFrame = null
    let timeout = null
    let startTime = null

    const start = currentValueRef.current
    const end = Number(value || 0)

    if (start === end) {
      setDisplayValue(end)
      return
    }

    function animate(currentTime) {
      if (!startTime) startTime = currentTime

      const progress = Math.min((currentTime - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = start + (end - start) * ease

      currentValueRef.current = current
      setDisplayValue(current)

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      } else {
        currentValueRef.current = end
        setDisplayValue(end)
      }
    }

    timeout = setTimeout(() => {
      animationFrame = requestAnimationFrame(animate)
    }, delay)

    return () => {
      if (timeout) clearTimeout(timeout)
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [value, duration, delay])

  return formatCurrency(displayValue)
}



function App() {


  function formatTopExpenseName(transaction) {
    const desc =
      transaction.display_description ||
      transaction.normalized_description ||
      transaction.raw_description ||
      ''

    if (transaction.transaction_type === 'credit_card_bill_payment') {
      return 'Pagamento de fatura'
    }

    if (transaction.transaction_type === 'pix_out') {
      const match = desc.match(/pix (.*)/i)
      if (match && match[1]) {
        return `Pix → ${match[1].slice(0, 18)}`
      }
      return 'Pix enviado'
    }

    if (transaction.transaction_type === 'transfer_out') {
      return 'Transferência enviada'
    }

    if (transaction.transaction_type === 'bill_payment') {
      return desc.slice(0, 24)
    }

    return desc.slice(0, 24)
  }

  function buildNarrative(insights) {
    if (!insights.length) return ''

    return insights
      .map((insight) => insight.message.replace(/\.$/, ''))
      .join(' • ')
      + '.'
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function AnimatedBarLabel({ x, y, width, height, value, duration = ANIMATION.normal, delay = 0 }) {
    const [displayValue, setDisplayValue] = useState(0)

    useEffect(() => {
      let frame = null
      let startTime = null
      let timeout = null

      const end = Number(value || 0)

      function animate(currentTime) {
        if (!startTime) startTime = currentTime

        const progress = Math.min((currentTime - startTime) / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)
        const current = end * ease

        setDisplayValue(current)

        if (progress < 1) {
          frame = requestAnimationFrame(animate)
        }
      }

      timeout = setTimeout(() => {
        frame = requestAnimationFrame(animate)
      }, delay)

      return () => {
        if (timeout) clearTimeout(timeout)
        if (frame) cancelAnimationFrame(frame)
      }
    }, [value, duration, delay])

    return (
      <text
        x={x + width + 10}
        y={y + height / 2}
        fill="#e5e7eb"
        fontSize={13}
        fontWeight={600}
        dominantBaseline="middle"
        textAnchor="start"
      >
        {formatCurrency(displayValue)}
      </text>
    )
  }







  function formatAxisCurrency(value) {
    const number = Number(value || 0)

    if (number >= 1000) {
      const formatted = (number / 1000).toLocaleString('pt-BR', {
        maximumFractionDigits: 1,
      })

      return `R$\u00A0${formatted}\u00A0mil`
    }

    return `R$\u00A0${number.toLocaleString('pt-BR')}`
  }


  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isRefreshingData, setIsRefreshingData] = useState(false)
  const [months, setMonths] = useState([])
  const [byCategory, setByCategory] = useState([])
  const [monthlyTrend, setMonthlyTrend] = useState([])
  const [dailyTrend, setDailyTrend] = useState([])
  const [categorySchema, setCategorySchema] = useState([])
  const [activeDonutCategory, setActiveDonutCategory] = useState(null)

  const [filters, setFilters] = useState({
    year: '',
    month: '',
  })

  const [authLoading, setAuthLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const navigate = useNavigate()

  const userDisplayName = userEmail ? userEmail.split('@')[0] : 'usuário'

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  const isYearView = !filters.month

  const dashboardAnimationKey = filters.month || filters.year || 'all'

  const reserveNet = Number(summary?.reserve_net ?? 0)
  const reserveDependency = Number(summary?.reserve_dependency ?? 0)

  const insights = generateInsights({
    summary,
    byCategory,
    transactions,
    isYearView,
    reserveNet,
    reserveDependency,
  })




  const schemaColorMap = categorySchema.reduce((accumulator, item) => {
    accumulator[item.key] = item.color
    return accumulator
  }, {})

  const FALLBACK_COLORS = [
    '#a78bfa',
    '#22c55e',
    '#ef4444',
    '#facc15',
    '#38bdf8',
    '#f97316',
    '#ec4899',
    '#14b8a6',
    '#6366f1',
    '#84cc16',
  ]

  const formatCategory = (name) => {
    if (!name) return ''

    if (name?.startsWith('outros_')) {
      return 'Outros'
    }

    const schemaItem = categorySchema.find((item) => item.key === name)

    if (schemaItem?.label) {
      return schemaItem.label
    }

    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }


  const getCategoryColor = (category) => {
    if (!category) {
      return '#71717a'
    }

    if (schemaColorMap[category]) {
      return schemaColorMap[category]
    }

    return '#71717a'
  }

  const renderDonutTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) {
      return null
    }

    const item = payload[0]
    const value = Number(item.value || 0)

    const total = expenseByCategory.reduce(
      (acc, category) => acc + Number(category.value || 0),
      0
    )

    const percentage = total > 0 ? (value / total) * 100 : 0

    // 🧠 texto “IA”
    let insightText = ''

    if (percentage >= 40) {
      insightText = 'Essa categoria domina seus gastos.'
    } else if (percentage >= 25) {
      insightText = 'Representa uma fatia relevante do seu orçamento.'
    } else if (percentage >= 10) {
      insightText = 'Tem impacto moderado nos seus gastos.'
    } else {
      insightText = 'Participação pequena no total.'
    }

    return (
      <div
        style={{
          background: 'rgba(24, 10, 35, 0.98)',
          border: '1px solid rgba(167, 139, 250, 0.35)',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
          maxWidth: 240,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            color: '#e5e7eb',
            fontWeight: 600,
          }}
        >
          {formatCategory(item.name)}
        </p>

        <p
          style={{
            margin: '6px 0 0',
            fontSize: '13px',
            color: '#cbd5e1',
          }}
        >
          {`${formatCurrency(value)} • ${percentage.toFixed(1).replace('.', ',')}%`}
        </p>

        <p
          style={{
            margin: '8px 0 0',
            fontSize: '12px',
            color: '#a78bfa',
            lineHeight: 1.4,
          }}
        >
          {insightText}
        </p>
      </div>
    )
  }

  const iconMap = {
    alert: '⚠️',
    positive: '✅',
    warning: '💰',
    highlight: '💳',
    info: '📊'
  }

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        navigate('/auth')
        setAuthLoading(false)
        return
      }

      setUserEmail(data.session.user.email || '')
      setAuthLoading(false)
    }

    checkSession()
  }, [navigate])

  useEffect(() => {
    if (authLoading) {
      return
    }

    async function fetchData() {
      try {
        if (!summary) {
          setLoading(true)
        } else {
          setIsRefreshingData(true)
        }

        setError('')

        const queryParams = new URLSearchParams()

        if (filters.month) {
          queryParams.append('month', filters.month)
        } else if (filters.year) {
          queryParams.append('year', filters.year)
        }
        queryParams.append('limit', 100)

        const queryString = queryParams.toString()

        const monthsResponse = await authFetch('/api/transactions/months')

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
          categorySchemaResponse,
          dailyTrendResponse,
        ] = await Promise.all([
          authFetch(`/api/transactions?${queryString}`),
          authFetch(`/api/summary/consolidated?${queryString}`),
          authFetch(`/api/summary/by-category?${queryString}`),
          authFetch('/api/summary/monthly-trend'),
          fetch(`${API_BASE_URL}/api/categories/schema`),
          filters.month
            ? authFetch(`/api/daily-trend?month=${filters.month}`)
            : Promise.resolve({
              ok: true,
              json: async () => ({ daily_trend: [] }),
            }),
        ])

        if (
          !transactionsResponse.ok ||
          !summaryResponse.ok ||
          !byCategoryResponse.ok ||
          !monthlyTrendResponse.ok ||
          !categorySchemaResponse.ok
        ) {
          throw new Error('Erro ao buscar dados da API')
        }

        const transactionsData = await transactionsResponse.json()
        const summaryData = await summaryResponse.json()
        const byCategoryData = await byCategoryResponse.json()
        const monthlyTrendData = await monthlyTrendResponse.json()
        const categorySchemaData = await categorySchemaResponse.json()

        let dailyTrendData = { daily_trend: [] }

        if (dailyTrendResponse && dailyTrendResponse.ok) {
          dailyTrendData = await dailyTrendResponse.json()
        }

        setTransactions(transactionsData.items || [])
        setSummary(summaryData)
        setByCategory(byCategoryData.by_category || [])
        setMonthlyTrend(monthlyTrendData.monthly_trend || [])
        setCategorySchema(categorySchemaData.categories || [])
        setDailyTrend(dailyTrendData.daily_trend || [])
      } catch (err) {
        setError(err.message || 'Erro inesperado')
      } finally {
        setLoading(false)
        setIsRefreshingData(false)
      }
    }

    fetchData()
  }, [filters, authLoading])

  function formatMonthLabel(monthStr) {
    const [, month] = monthStr.split('-')

    const map = {
      '01': 'jan',
      '02': 'fev',
      '03': 'mar',
      '04': 'abr',
      '05': 'mai',
      '06': 'jun',
      '07': 'jul',
      '08': 'ago',
      '09': 'set',
      '10': 'out',
      '11': 'nov',
      '12': 'dez',
    }

    return map[month] || month
  }


  function formatFullMonthLabel(monthStr) {
    const [, month] = monthStr.split('-')

    const map = {
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

    return map[month] || month
  }

  const MONTH_OPTIONS = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ]



  const availableMonthsSet = new Set(months)

  const availableYears = [...new Set(months.map((month) => month.slice(0, 4)))]
    .sort((a, b) => Number(b) - Number(a))

  const selectedYear =
    filters.year ||
    filters.month?.slice(0, 4) ||
    (availableYears.length > 0 ? availableYears[0] : '')

  const sidebarMonths = MONTH_OPTIONS.map((item) => {
    const fullMonth = `${selectedYear}-${item.value}`

    return {
      ...item,
      fullMonth,
      hasData: availableMonthsSet.has(fullMonth),
      isActive: filters.month === fullMonth,
    }
  })

  const monthlyTrendChartData = monthlyTrend
    .filter((item) => item.month.startsWith(selectedYear))
    .map((item) => ({
      name: formatMonthLabel(item.month),
      income: item.income,
      expenses: item.expenses,
    }))

  const dailyTrendChartData = dailyTrend.map((item) => ({
    name: item.date,
    income: item.income,
    expenses: item.expense,
    items: item.items || [],
  }))

  const analysisChartData = isYearView ? monthlyTrendChartData : dailyTrendChartData

  const maxAnalysisValue = Math.max(
    0,
    ...analysisChartData.map((item) =>
      Math.max(Number(item.income || 0), Number(item.expenses || 0))
    )
  )

  const roundedMaxAnalysisValue =
    maxAnalysisValue <= 0
      ? 1000
      : Math.ceil(maxAnalysisValue / 1000) * 1000

  const analysisTicks = Array.from({ length: 5 }, (_, index) =>
    Math.round((roundedMaxAnalysisValue / 4) * index)
  )

  const monthlyIncome = Number(summary?.total_income ?? 0)
  const monthlyExpenses = Number(summary?.total_expenses ?? 0)
  const monthlyBalance = monthlyIncome - monthlyExpenses

  const kpiSparklineData = analysisChartData.length
    ? analysisChartData
    : [
      {
        income: monthlyIncome,
        expenses: monthlyExpenses,
      },
    ]

  const incomeSparklineData = kpiSparklineData.map((item) =>
    Number(item.income || 0)
  )

  const expensesSparklineData = kpiSparklineData.map((item) =>
    Number(item.expenses || 0)
  )

  const balanceSparklineData = kpiSparklineData.map((item) =>
    Number(item.income || 0) - Number(item.expenses || 0)
  )

  const rawCategories = byCategory
    .filter((item) => item.expense_total > 0)
    .map((item) => ({
      name: item.category,
      value: item.expense_total,
    }))
    .sort((a, b) => b.value - a.value)

  const MAX_VISIBLE_CATEGORIES = 5

  const explicitOthers = rawCategories.find((item) => item.name === 'outros')

  const categoriesWithoutOthers = rawCategories.filter(
    (item) => item.name !== 'outros'
  )

  const visibleCategories = categoriesWithoutOthers.slice(0, MAX_VISIBLE_CATEGORIES)
  const hiddenCategories = categoriesWithoutOthers.slice(MAX_VISIBLE_CATEGORIES)
  const hiddenCategoriesCount = hiddenCategories.length

  const hiddenCategoriesTotal = hiddenCategories.reduce(
    (acc, item) => acc + item.value,
    0
  )

  const expenseByCategory = [
    ...visibleCategories,
    ...(hiddenCategoriesTotal > 0
      ? [{
        name: 'outros',
        value: hiddenCategoriesTotal,
        hiddenCount: hiddenCategories.length,
        hiddenNames: hiddenCategories.map((category) =>
          formatCategory(category.name)
        ),
      }]
      : []),
  ]


  const donutLegendItems = expenseByCategory

  const EXPENSE_TYPES = [
    'credit_card_bill_payment',
    'pix_out',
    'transfer_out',
    'bill_payment',
  ]

  const donutTotal = expenseByCategory.reduce(
    (accumulator, item) => accumulator + Number(item.value || 0),
    0
  )

  function formatDonutPercentage(value) {
    if (!donutTotal) return '0%'

    const percentage = (Number(value || 0) / donutTotal) * 100

    return `${percentage.toFixed(1).replace('.', ',')}%`
  }


  const groupedExpenses = {}

  transactions
    .filter((transaction) =>
      EXPENSE_TYPES.includes(transaction.transaction_type)
    )
    .forEach((transaction) => {
      const name = formatTopExpenseName(transaction)

      if (!groupedExpenses[name]) {
        groupedExpenses[name] = {
          total: 0,
          count: 0,
        }
      }

      groupedExpenses[name].total += transaction.absolute_amount
      groupedExpenses[name].count += 1
    })

  const topExpenses = Object.entries(groupedExpenses)
    .map(([name, data]) => ({
      name: `${name} (${data.count})`,
      value: data.total,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)



  function renderDailyTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null

    const data = payload?.[0]?.payload
    if (!data) return null

    const items = data.items || []

    return (
      <div
        style={{
          background: 'rgba(24, 10, 35, 0.98)',
          border: '1px solid rgba(167, 139, 250, 0.35)',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          maxWidth: 480,
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>
          Dia {String(label).padStart(2, '0')}
        </p>

        <div style={{ marginTop: 8 }}>
          {items.length === 0 && (
            <p style={{ margin: 0, color: '#a1a1aa' }}>
              Sem movimentações
            </p>
          )}

          {items.map((item, index) => (
            <p
              key={index}
              style={{
                margin: '8px 0',
                fontSize: 13,
                color: '#f4f4f5',
                lineHeight: 1.35,
              }}
            >
              <span>{item.type === 'income' ? '+' : '-'} </span>
              <span>{item.description.slice(0, 42)}</span>
              <strong
                style={{
                  marginLeft: 8,
                  color: item.type === 'income' ? '#22c55e' : '#f43f5e',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatCurrency(item.amount)}
              </strong>
            </p>
          ))}
        </div>
      </div>
    )
  }

  if (authLoading) return <PageLoader />
  if (loading) return <PageLoader />
  if (error) return <h1>{error}</h1>




  return (
    <main>
      <div className="container">


        <div className="dashboard-layout">
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-brand">
                <div className="sidebar-logo-row">
                  <img
                    src={logo}
                    alt="Velora AI"
                    className="sidebar-logo"
                  />
                </div>
                <p>Clareza financeira com inteligência artificial</p>


              </div>
              <p>Ano</p>
              <ul>
                {availableYears.map((year) => (
                  <li
                    key={year}
                    className={selectedYear === year ? 'active has-data' : 'has-data'}
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        year,
                        month:
                          prev.month && prev.month.startsWith(year)
                            ? prev.month
                            : '',
                      }))
                    }
                  >
                    {year}
                  </li>
                ))}
              </ul>
            </div>

            <div className="sidebar-section">
              <p>Mês</p>
              <ul>
                {sidebarMonths.map((month) => (
                  <li
                    key={month.fullMonth}
                    className={[
                      month.isActive ? 'active' : '',
                      month.hasData ? 'has-data' : 'no-data',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      if (!month.hasData) return

                      setFilters((prev) => ({
                        ...prev,
                        year: selectedYear,
                        month: prev.month === month.fullMonth ? '' : month.fullMonth,
                      }))
                    }}
                  >
                    {month.label}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="dashboard-content">

            {isRefreshingData && (
              <div className="dashboard-refresh-indicator">
                Atualizando dados...
              </div>
            )}

            <section className="summary-grid section-spacing">

              <div className="dashboard-welcome">
                <div className="dashboard-welcome-left">
                  <div>
                    <h1>Olá, {userDisplayName}</h1>
                    <p>Acompanhe seus gastos, reserva e categorias do mês.</p>
                  </div>

                  <a
                    href="/transactions"
                    className="transactions-icon"
                    title="Transações"
                  ></a>
                </div>



                <div className="dashboard-welcome-right">
                  <button
                    type="button"
                    className="logout-button"
                    onClick={handleLogout}
                  >
                    Sair
                  </button>
                </div>
              </div>

              <div className="card kpi-card kpi-income">
                <div className="kpi-card-content">
                  <p>{isYearView ? 'Entrada anual' : 'Entrada do mês'}</p>

                  <h2 style={{ color: 'var(--color-positive)' }}>
                    <AnimatedNumber value={monthlyIncome} />
                  </h2>

                </div>

                <KpiSparkline data={incomeSparklineData} tone="positive" />
              </div>

              <div className="card kpi-card kpi-expenses">
                <div className="kpi-card-content">
                  <p>{isYearView ? 'Saída do anual' : 'Saída do mês'}</p>
                  <h2 style={{ color: 'var(--color-negative)' }}>
                    <AnimatedNumber value={monthlyExpenses} />
                  </h2>
                </div>
                <KpiSparkline data={expensesSparklineData} tone="negative" />
              </div>

              <div className="card kpi-card kpi-balance">
                <div className="kpi-card-content">
                  <p>{isYearView ? 'Saldo anual' : 'Saldo do mês'}</p>
                  <h2
                    style={{
                      color:
                        monthlyBalance >= 0
                          ? 'var(--color-positive)'
                          : 'var(--color-negative)',
                    }}
                  >
                    <AnimatedNumber value={monthlyBalance} />
                  </h2>
                </div>
                <KpiSparkline
                  data={balanceSparklineData}
                  tone={monthlyBalance >= 0 ? 'positive' : 'negative'}
                />
              </div>

              <div className="table-container donut-card">
                <p>{isYearView ? 'Despesas anual' : 'Despesas do mês'}</p>

                <div className="donut-content">
                  < div className="donut-chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={
                            expenseByCategory.length
                              ? expenseByCategory
                              : [{ name: 'sem categoria', value: 1 }]
                          }
                          dataKey="value"
                          nameKey="name"
                          innerRadius={38}
                          outerRadius={52}
                          paddingAngle={2}
                          isAnimationActive={true}
                          animationBegin={160}
                          animationDuration={ANIMATION.slow}
                          animationEasing={ANIMATION.easing}
                          startAngle={90}
                          endAngle={-270}
                        >
                          {(expenseByCategory.length
                            ? expenseByCategory
                            : [{ name: 'sem categoria', value: 1 }]
                          ).map((entry, index) => (
                            <Cell
                              key={`month-cell-${index}`}
                              fill={getCategoryColor(entry.name)}
                              opacity={
                                activeDonutCategory && activeDonutCategory !== entry.name
                                  ? 0.35
                                  : 1
                              }
                              style={{
                                filter:
                                  activeDonutCategory === entry.name
                                    ? 'drop-shadow(0 0 10px rgba(255,255,255,0.28))'
                                    : 'none',
                                transition: 'opacity 0.22s ease, filter 0.22s ease',
                              }}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={renderDonutTooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="donut-legend">
                    {donutLegendItems.map((item) => (
                      <div
                        key={item.name}
                        className={`donut-legend-item ${activeDonutCategory === item.name ? 'is-active' : ''
                          }`}
                        onMouseEnter={() => setActiveDonutCategory(item.name)}
                        onMouseLeave={() => setActiveDonutCategory(null)}
                      >
                        <div className="donut-legend-label">
                          <span
                            className="donut-legend-color"
                            style={{
                              backgroundColor: getCategoryColor(item.name),
                            }}
                          />
                          <span>{formatCategory(item.name)}</span>

                          {item.hiddenCount > 0 && (
                            <span className="donut-other-tooltip">
                              <strong>{item.hiddenCount} categorias agrupadas</strong>
                              {item.hiddenNames.join(' • ')}
                            </span>
                          )}
                        </div>

                        <div className="donut-legend-values">
                          <strong>{formatCurrency(item.value)}</strong>
                          <span>{formatDonutPercentage(item.value)}</span>
                        </div>
                      </div>
                    ))}

                    {!donutLegendItems.length && (
                      <div className="donut-legend-empty">
                        Sem despesas categorizadas
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="ai-insights">

              <div className="ai-insights-grid">
                {insights.map((insight, index) => (
                  <div key={index} className={`ai-card ${insight.type}`}>
                    <h4>{iconMap[insight.type]} {insight.title}</h4>
                    <p>
                      <Typewriter
                        text={insight.message}
                        speed={16}
                        delay={300 + index * 140}
                      />
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="analytics-grid">
              <div className="table-container analytics-main-card">
                <h2>
                  {isYearView
                    ? 'Análise anual'
                    : `Análise diária de ${formatFullMonthLabel(filters.month)}`}
                </h2>

                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analysisChartData}
                      barCategoryGap="32%"
                      barGap={5}
                      margin={{ top: 35, right: 10, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="rgba(228, 228, 231, 0.08)"
                        strokeDasharray="0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="rgba(228, 228, 231, 0.55)"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="rgba(228, 228, 231, 0.35)"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          formatAxisCurrency(value).replace(' ', '\u00A0')
                        }
                        width={75}
                        domain={[0, roundedMaxAnalysisValue]}
                        ticks={analysisTicks}
                        tick={{
                          fill: '#a1a1aa',
                          fontSize: 15,
                          whiteSpace: 'nowrap',
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                        content={isYearView ? undefined : renderDailyTooltip}
                        formatter={isYearView ? (value) => formatCurrency(value) : undefined}
                        contentStyle={
                          isYearView
                            ? {
                              background: 'rgba(24, 10, 35, 0.98)',
                              border: '1px solid rgba(167, 139, 250, 0.35)',
                              borderRadius: '12px',
                              color: '#e5e7eb',
                              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
                              maxHeight: 360,
                              overflowY: 'auto',
                            }
                            : undefined
                        }
                      />
                      <Legend
                        verticalAlign="top"
                        align="left"
                        iconType="square"
                        formatter={(value) => (
                          <span style={{ color: '#f4f4f5' }}>{value}</span>
                        )}
                        wrapperStyle={{
                          top: 10,
                          left: 10,
                          fontSize: '13px',
                        }}
                      />
                      <Bar
                        dataKey="income"
                        name="Entradas"
                        fill="var(--color-positive)"
                        barSize={15}
                        radius={[6, 6, 0, 0]}
                        isAnimationActive={true}
                        animationBegin={120}
                        animationDuration={ANIMATION.normal}
                        animationEasing={ANIMATION.easing}
                      />

                      <Bar
                        dataKey="expenses"
                        name="Saídas"
                        fill="var(--color-negative)"
                        barSize={15}
                        radius={[6, 6, 0, 0]}
                        isAnimationActive={true}
                        animationBegin={ANIMATION.delay.chart}
                        animationDuration={ANIMATION.normal}
                        animationEasing={ANIMATION.easing}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="table-container analytics-side-card">
                <h2>{isYearView ? 'Top gastos anual' : 'Top gastos mensal'}</h2>


                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topExpenses}
                      layout="vertical"
                      barCategoryGap="26%"
                      margin={{ top: 35, right: 70, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="rgba(228, 228, 231, 0.08)"
                        strokeDasharray="0"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke="rgba(228, 228, 231, 0.35)"
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 'dataMax + 250']}
                        tickFormatter={(value) => `R$ ${formatCompactCurrency(value)}`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="rgba(228, 228, 231, 0.55)"
                        tickLine={false}
                        axisLine={false}
                        width={145}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{
                          background: 'rgba(24, 10, 35, 0.98)',
                          border: '1px solid rgba(167, 139, 250, 0.35)',
                          borderRadius: '12px',
                          color: '#e5e7eb',
                          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
                        }}
                        labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
                      />
                      <Bar
                        dataKey="value"
                        fill="var(--color-negative)"
                        barSize={20}
                        radius={[0, 8, 8, 0]}
                        isAnimationActive={true}
                        animationBegin={ANIMATION.delay.chart}
                        animationDuration={ANIMATION.normal}
                        animationEasing={ANIMATION.easing}
                      >
                        <LabelList
                          dataKey="value"
                          position="right"
                          content={(props) => (
                            <AnimatedBarLabel
                              {...props}
                              delay={ANIMATION.delay.chart}
                              duration={ANIMATION.normal}
                            />
                          )}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App