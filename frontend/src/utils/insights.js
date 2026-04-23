function formatInsightCategory(category) {
  if (!category) return ''

  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function generateInsights({
  summary,
  byCategory,
  transactions,
  isYearView = false,
}) {
  const insights = []

  if (!summary) return insights

  const periodLabel = isYearView ? 'ano' : 'mês'

  const income = Number(summary.total_income || 0)
  const expenses = Number(summary.total_expenses || 0)
  const balance = income - expenses

  if (balance > 0) {
    insights.push({
      type: 'positive',
      title: 'Fluxo positivo',
      message: `Você fechou o ${periodLabel} com saldo positivo de R$ ${balance.toFixed(2)}.`,
    })
  } else if (balance < 0) {
    insights.push({
      type: 'alert',
      title: 'Atenção',
      message: `Seu fluxo do ${periodLabel} ficou negativo em R$ ${Math.abs(balance).toFixed(2)}.`,
    })
  }

  if (byCategory?.length) {
    const topCategory = [...byCategory].sort(
      (a, b) => b.expense_total - a.expense_total
    )[0]

    if (topCategory && topCategory.expense_total > 0) {
      insights.push({
        type: 'info',
        title: 'Categoria dominante',
        message: `${formatInsightCategory(topCategory.category)} foi sua principal categoria de gasto no ${periodLabel}.`,
      })
    }
  }

  const reserve = Number(summary.reserve_redemption_total || 0)
  const reservePct = Number(summary.reserve_dependency || 0)

  if (reserve > 0) {
    insights.push({
      type: 'warning',
      title: 'Uso da reserva',
      message: `Uso elevado da reserva no ${periodLabel}: R$ ${reserve.toFixed(2)} (${reservePct.toFixed(1)}% das saídas).`,
    })
  }

  const expenseTypes = [
    'credit_card_bill_payment',
    'pix_out',
    'transfer_out',
    'bill_payment',
  ]

  const filtered = transactions.filter((t) =>
    expenseTypes.includes(t.transaction_type)
  )

  if (filtered.length) {
    const grouped = {}

    filtered.forEach((t) => {
      const key = t.transaction_type
      grouped[key] = (grouped[key] || 0) + Number(t.absolute_amount || 0)
    })

    const topType = Object.entries(grouped).sort((a, b) => b[1] - a[1])[0]

    if (topType) {
      const labels = {
        credit_card_bill_payment: 'Pagamento de fatura',
        pix_out: 'Pix enviado',
        transfer_out: 'Transferência enviada',
        bill_payment: 'Pagamento de boleto',
      }

      insights.push({
        type: 'highlight',
        title: 'Maior impacto',
        message: `${labels[topType[0]] || topType[0]} representou sua principal saída no ${periodLabel}.`,
      })
    }
  }

  return insights.slice(0, 4)
}