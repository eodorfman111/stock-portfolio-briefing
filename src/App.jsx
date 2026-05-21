import { useState } from 'react'

const DEFAULT_PORTFOLIO = `AAPL 81.23
AMZN 83.50
NVDA 62.54
AMD 27.98
MSFT 7.02
PANW 12.18
GOOG 6.00
META 2.80
BRK.B 3.02
ARM 5.41
NFLX 10
DKNG 29
MDB 2
GOOGL 0.65
TSLA 0.40`

function parsePortfolio(text) {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 2) {
        return { ticker: parts[0].toUpperCase(), shares: parseFloat(parts[1]) }
      }
      return null
    })
    .filter((h) => h && !isNaN(h.shares) && h.shares > 0)
}

function buildPrompt(holdings, budget) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `You are a financial briefing assistant. Today is ${today}.

The user holds the following stock portfolio:
${holdings.map((h) => `${h.ticker}: ${h.shares} shares`).join('\n')}

Daily investment budget: $${budget}

Simulate realistic stock prices and daily changes for each holding. Use plausible current market prices for each ticker. Calculate the total portfolio value and daily percentage change.

Then recommend how to allocate the $${budget} daily budget across stocks that are DOWN today. The allocations must sum to exactly $${budget}.

Return ONLY valid JSON (no markdown, no code fences, no explanation) with this exact structure:
{
  "date": "${today}",
  "totalValue": <number>,
  "dailyChange": <number as percentage like 0.45 or -1.23>,
  "briefingSummary": "<2-3 sentence market summary>",
  "holdings": [
    {
      "ticker": "<string>",
      "shares": <number>,
      "price": <number>,
      "change": <number as percentage>,
      "value": <number>
    }
  ],
  "suggestion": {
    "headline": "<short recommendation headline>",
    "allocations": [
      { "ticker": "<string>", "amount": <number> }
    ],
    "rationale": "<1-2 sentence explanation>"
  }
}`
}

async function callClaudeAPI(apiKey, holdings, budget) {
  const prompt = buildPrompt(holdings, budget)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  const text = data.content[0].text
  return JSON.parse(text)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function formatPercent(value) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function changeColor(value) {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-gray-400'
}

function changeBg(value) {
  if (value > 0) return 'bg-emerald-500/10 text-emerald-400'
  if (value < 0) return 'bg-red-500/10 text-red-400'
  return 'bg-gray-500/10 text-gray-400'
}

function App() {
  const [portfolio, setPortfolio] = useState(DEFAULT_PORTFOLIO)
  const [budget, setBudget] = useState(100)
  const [apiKey, setApiKey] = useState('')
  const [briefing, setBriefing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Anthropic API key.')
      return
    }

    const holdings = parsePortfolio(portfolio)
    if (holdings.length === 0) {
      setError('Please enter at least one valid holding (TICKER SHARES).')
      return
    }

    setLoading(true)
    setError(null)
    setBriefing(null)

    try {
      const result = await callClaudeAPI(apiKey, holdings, budget)
      setBriefing(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Morning Portfolio Briefing
          </h1>
          <p className="text-gray-400 mt-2">
            AI-powered daily stock analysis &amp; buy recommendations
          </p>
        </div>

        {/* Controls */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Portfolio Input */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Portfolio Holdings
              <span className="text-gray-500 font-normal ml-2">
                (TICKER SHARES per line)
              </span>
            </label>
            <textarea
              className="w-full h-64 bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
            />
          </div>

          {/* Settings */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Anthropic API Key
              </label>
              <input
                type="password"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Daily Budget:{' '}
                <span className="text-blue-400 font-semibold">
                  {formatCurrency(budget)}
                </span>
              </label>
              <input
                type="range"
                min="25"
                max="500"
                step="25"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>$25</span>
                <span>$500</span>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="mt-auto w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Generating Briefing...
                </span>
              ) : (
                'Generate Morning Briefing'
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8 text-red-400">
            {error}
          </div>
        )}

        {/* Briefing Results */}
        {briefing && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <p className="text-sm text-gray-400 mb-1">Date</p>
                <p className="text-lg font-semibold text-white">
                  {briefing.date}
                </p>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <p className="text-sm text-gray-400 mb-1">Total Portfolio Value</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(briefing.totalValue)}
                </p>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <p className="text-sm text-gray-400 mb-1">Daily Change</p>
                <p className={`text-2xl font-bold ${changeColor(briefing.dailyChange)}`}>
                  {formatPercent(briefing.dailyChange)}
                </p>
              </div>
            </div>

            {/* Market Summary */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="text-lg font-semibold text-white mb-2">
                Market Summary
              </h2>
              <p className="text-gray-300 leading-relaxed">
                {briefing.briefingSummary}
              </p>
            </div>

            {/* Holdings Table */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-5 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">Holdings</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                      <th className="px-5 py-3 font-medium">Ticker</th>
                      <th className="px-5 py-3 font-medium text-right">Shares</th>
                      <th className="px-5 py-3 font-medium text-right">Price</th>
                      <th className="px-5 py-3 font-medium text-right">Change</th>
                      <th className="px-5 py-3 font-medium text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {briefing.holdings.map((h) => (
                      <tr
                        key={h.ticker}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-5 py-3 font-semibold text-white">
                          {h.ticker}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-300">
                          {h.shares}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-300">
                          {formatCurrency(h.price)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-sm font-medium ${changeBg(h.change)}`}
                          >
                            {formatPercent(h.change)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-gray-200">
                          {formatCurrency(h.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Buy Recommendation */}
            {briefing.suggestion && (
              <div className="bg-gray-900 rounded-xl border border-blue-500/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <h2 className="text-lg font-semibold text-white">
                    Buy Recommendation
                  </h2>
                </div>
                <p className="text-blue-400 font-medium text-lg mb-3">
                  {briefing.suggestion.headline}
                </p>

                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  {briefing.suggestion.allocations.map((a) => (
                    <div
                      key={a.ticker}
                      className="bg-blue-500/10 rounded-lg p-3 flex items-center justify-between"
                    >
                      <span className="font-semibold text-white">
                        {a.ticker}
                      </span>
                      <span className="text-blue-400 font-bold">
                        {formatCurrency(a.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm border-t border-gray-800 pt-3">
                  <p className="text-gray-400">
                    {briefing.suggestion.rationale}
                  </p>
                  <p className="text-gray-500 ml-4 shrink-0">
                    Total:{' '}
                    <span className="text-white font-semibold">
                      {formatCurrency(
                        briefing.suggestion.allocations.reduce(
                          (sum, a) => sum + a.amount,
                          0
                        )
                      )}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
