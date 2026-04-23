import { useEffect, useState } from 'react'
import PageLoader from './components/PageLoader'
import { generateInsights } from './utils/insights'

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

  function formatCompactCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }).replace('mil', ' mil').replace('mi', ' mi')
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
  const [months, setMonths] = useState([])
  const [byCategory, setByCategory] = useState([])
  const [monthlyTrend, setMonthlyTrend] = useState([])
  const [categorySchema, setCategorySchema] = useState([])

  const [filters, setFilters] = useState({
    year: '',
    month: '',
  })

  const isYearView = !filters.month

  const insights = generateInsights({
    summary,
    byCategory,
    transactions,
    isYearView,
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

    const schemaItem = categorySchema.find((item) => item.key === name)

    // prioridade total pro backend
    if (schemaItem?.label) {
      return schemaItem.label
    }

    // fallback mais bonito
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
      (accumulator, category) => accumulator + Number(category.value || 0),
      0
    )

    const percentage = total > 0 ? (value / total) * 100 : 0

    return (
      <div
        style={{
          background: '#111827',
          border: '1px solid rgba(167, 139, 250, 0.25)',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
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
          {`${formatCurrency(value)} • ${percentage.toFixed(1)}%`}
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
    async function fetchData() {
      try {
        setLoading(true)
        setError('')

        const queryParams = new URLSearchParams()

        if (filters.month) {
          queryParams.append('month', filters.month)
        } else if (filters.year) {
          queryParams.append('year', filters.year)
        }
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
          categorySchemaResponse,
        ] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/transactions?${queryString}`),
          fetch(`http://127.0.0.1:8000/api/summary/consolidated?${queryString}`),
          fetch(`http://127.0.0.1:8000/api/summary/by-category?${queryString}`),
          fetch('http://127.0.0.1:8000/api/summary/monthly-trend'),
          fetch('http://127.0.0.1:8000/api/categories/schema'),
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

        setTransactions(transactionsData.items || [])
        setSummary(summaryData)
        setByCategory(byCategoryData.by_category || [])
        setMonthlyTrend(monthlyTrendData.monthly_trend || [])
        setCategorySchema(categorySchemaData.categories || [])
      } catch (err) {
        setError(err.message || 'Erro inesperado')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [filters])

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

  const monthlyIncome = Number(summary?.total_income ?? 0)
  const monthlyExpenses = Number(summary?.total_expenses ?? 0)
  const monthlyBalance = monthlyIncome - monthlyExpenses
  const reserveNet = Number(summary?.reserve_net ?? 0)
  const reserveDependency = Number(summary?.reserve_dependency ?? 0)

  const rawCategories = byCategory
    .filter((item) => item.expense_total > 0)
    .map((item) => ({
      name: item.category,
      value: item.expense_total,
    }))
    .sort((a, b) => b.value - a.value)

  const MAX_VISIBLE_CATEGORIES = 8

  const explicitOthers = rawCategories.find((item) => item.name === 'outros')

  const categoriesWithoutOthers = rawCategories.filter(
    (item) => item.name !== 'outros'
  )

  const visibleCategories = categoriesWithoutOthers.slice(0, MAX_VISIBLE_CATEGORIES)
  const hiddenCategories = categoriesWithoutOthers.slice(MAX_VISIBLE_CATEGORIES)

  const hiddenCategoriesTotal = hiddenCategories.reduce(
    (acc, item) => acc + item.value,
    0
  )

  const expenseByCategory = [
    ...visibleCategories,
    ...(hiddenCategoriesTotal > 0
      ? [{ name: 'mais_categorias', value: hiddenCategoriesTotal }]
      : []),
    ...(explicitOthers ? [explicitOthers] : []),
  ]

  const donutLegendItems = expenseByCategory

  const EXPENSE_TYPES = [
    'credit_card_bill_payment',
    'pix_out',
    'transfer_out',
    'bill_payment',
  ]



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

  if (loading) return <PageLoader />
  if (error) return <h1>{error}</h1>




  return (
    <main>
      <div className="container">


        <div className="dashboard-layout">
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-brand">
                <h1>FinSight AI</h1>
                <p>Análise real do seu fluxo financeiro</p>

                <a href="/transactions" className="sidebar-brand-link">
                  Ver transações →
                </a>
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
            <section className="summary-grid section-spacing">
              <div className="card kpi-card kpi-income">
                <div className="kpi-card-content">
                  <p>{isYearView ? 'Entrada anual' : 'Entrada do mês'}</p>
                  <h2 style={{ color: 'var(--color-positive)' }}>
                    {formatCurrency(monthlyIncome)}
                  </h2>
                </div>
                <div className="kpi-sparkline kpi-sparkline-positive" />
              </div>

              <div className="card kpi-card kpi-expenses">
                <div className="kpi-card-content">
                  <p>{isYearView ? 'Saída do anual' : 'Saída do mês'}</p>
                  <h2 style={{ color: 'var(--color-negative)' }}>
                    {formatCurrency(monthlyExpenses)}
                  </h2>
                </div>
                <div className="kpi-sparkline kpi-sparkline-negative" />
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
                    {formatCurrency(monthlyBalance)}
                  </h2>
                </div>
                <div
                  className={`kpi-sparkline ${monthlyBalance >= 0
                    ? 'kpi-sparkline-positive'
                    : 'kpi-sparkline-negative'
                    }`}
                />
              </div>

              <div className="reserve-strip">
                <div className="reserve-strip-card">
                  <div className="reserve-strip-label">
                    {reserveNet > 0
                      ? 'Uso da reserva'
                      : reserveNet < 0
                        ? 'Aumento da reserva'
                        : 'Reserva estável'}
                  </div>

                  <div className="reserve-strip-values">
                    <strong>{formatCurrency(Math.abs(reserveNet))}</strong>
                    <span>
                      {reserveNet > 0
                        ? `${reserveDependency.toFixed(1)}% das saídas do ${isYearView ? 'ano' : 'mês'}`
                        : reserveNet < 0
                          ? `Você aumentou sua reserva neste ${isYearView ? 'ano' : 'mês'}`
                          : `Sem impacto na reserva`}
                    </span>
                  </div>
                </div>
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
                        >
                          {(expenseByCategory.length
                            ? expenseByCategory
                            : [{ name: 'sem categoria', value: 1 }]
                          ).map((entry, index) => (
                            <Cell
                              key={`month-cell-${index}`}
                              fill={getCategoryColor(entry.name)}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={renderDonutTooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="donut-legend">
                    {donutLegendItems.map((item) => (
                      <div key={item.name} className="donut-legend-item">
                        <div className="donut-legend-label">
                          <span
                            className="donut-legend-color"
                            style={{
                              backgroundColor: getCategoryColor(item.name),
                            }}
                          />
                          <span>{formatCategory(item.name)}</span>
                        </div>

                        <strong>{formatCurrency(item.value)}</strong>
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
                        speed={18}
                        delay={1100 + index * 800}
                      />
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="analytics-grid">
              <div className="table-container analytics-main-card">
                <h2>{isYearView ? 'Análise anual' : 'Análise mensal'}</h2>

                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyTrendChartData}
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
                        ticks={[0, 5000, 10000, 15000, 20000, 25000]}
                        tick={{
                          fill: '#a1a1aa',
                          fontSize: 15,
                          whiteSpace: 'nowrap',
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{
                          background: '#111827',
                          border: '1px solid rgba(167, 139, 250, 0.18)',
                          borderRadius: '12px',
                          color: '#e5e7eb',
                          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
                        }}
                        labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
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
                      />

                      <Bar
                        dataKey="expenses"
                        name="Saídas"
                        fill="var(--color-negative)"
                        barSize={15}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="table-container analytics-side-card">
                <h2>{isYearView ? 'Top gastos anual' : 'Top gastos mensal'}</h2>


                <div style={{ width: '100%', height: 280 }}>
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
                          background: '#111827',
                          border: '1px solid rgba(167, 139, 250, 0.18)',
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
                      >
                        <LabelList
                          dataKey="value"
                          position="right"
                          formatter={(value) => formatCurrency(value)}
                          style={{
                            fill: '#e5e7eb',
                            fontSize: 13,
                            fontWeight: 600,
                          }}
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