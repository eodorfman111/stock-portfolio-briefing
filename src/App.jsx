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

const DEFAULT_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || ''

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

function fmt(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function pct(value) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function Arrow({ up }) {
  return up ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
  )
}

function App() {
  const [portfolio, setPortfolio] = useState(DEFAULT_PORTFOLIO)
  const [budget, setBudget] = useState(100)
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY)
  const [briefing, setBriefing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

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
    <div className="min-h-screen bg-[#0a0b0f] text-white antialiased">
      {/* Gradient background accents */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-80 h-80 bg-violet-600/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-64 bg-emerald-600/4 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Morning Briefing</h1>
              </div>
              <p className="text-sm text-gray-500 ml-[52px]">AI-powered portfolio analysis</p>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/>
              </svg>
              Settings
            </button>
          </div>
        </header>

        {/* Settings Panel (collapsible) */}
        {showSettings && (
          <div className="mb-8 bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 space-y-5">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Portfolio Holdings
                </label>
                <textarea
                  className="w-full h-56 bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-mono text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/30 resize-none placeholder-gray-600"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  placeholder="AAPL 100&#10;GOOG 50"
                />
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/30 placeholder-gray-600"
                    placeholder="sk-ant-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Daily Budget
                    </label>
                    <span className="text-sm font-semibold text-blue-400">{fmt(budget)}</span>
                  </div>
                  <input
                    type="range"
                    min="25"
                    max="500"
                    step="25"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full accent-blue-500 h-2"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>$25</span>
                    <span>$250</span>
                    <span>$500</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Action */}
        <div className="mb-8 flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-8 rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 cursor-pointer text-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing Portfolio...
              </span>
            ) : (
              'Generate Morning Briefing'
            )}
          </button>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {parsePortfolio(portfolio).length} holdings
            </span>
            <span className="text-gray-700">|</span>
            <span>{fmt(budget)}/day budget</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 bg-red-500/5 border border-red-500/20 rounded-xl px-5 py-4 text-red-400 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <p>{error}</p>
          </div>
        )}

        {/* Results */}
        {briefing && (
          <div className="space-y-6 animate-in">
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Date</p>
                <p className="text-lg font-medium text-gray-200">{briefing.date}</p>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Portfolio Value</p>
                <p className="text-3xl font-bold tracking-tight">{fmt(briefing.totalValue)}</p>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Daily Change</p>
                <div className="flex items-center gap-2">
                  <p className={`text-3xl font-bold tracking-tight ${briefing.dailyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pct(briefing.dailyChange)}
                  </p>
                  <div className={`p-1 rounded-full ${briefing.dailyChange >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    <Arrow up={briefing.dailyChange >= 0} />
                  </div>
                </div>
              </div>
            </div>

            {/* Market Summary */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-500 to-violet-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Market Summary</h2>
              </div>
              <p className="text-gray-300 leading-relaxed text-[15px]">{briefing.briefingSummary}</p>
            </div>

            {/* Holdings Table */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Holdings Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/[0.04]">
                      <th className="text-left px-6 py-3 font-medium">Stock</th>
                      <th className="text-right px-6 py-3 font-medium">Shares</th>
                      <th className="text-right px-6 py-3 font-medium">Price</th>
                      <th className="text-right px-6 py-3 font-medium">Change</th>
                      <th className="text-right px-6 py-3 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {briefing.holdings.map((h, i) => (
                      <tr key={h.ticker} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${i === briefing.holdings.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${h.change >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                              {h.ticker.slice(0, 2)}
                            </div>
                            <span className="font-semibold text-white">{h.ticker}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-400 tabular-nums">{h.shares}</td>
                        <td className="px-6 py-3.5 text-right text-gray-300 tabular-nums font-medium">{fmt(h.price)}</td>
                        <td className="px-6 py-3.5 text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${h.change >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            <Arrow up={h.change >= 0} />
                            {pct(h.change)}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold text-white tabular-nums">{fmt(h.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Buy Recommendation */}
            {briefing.suggestion && (
              <div className="bg-gradient-to-br from-blue-600/[0.08] to-violet-600/[0.08] backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Buy Recommendation</h2>
                    <p className="text-blue-400 font-medium">{briefing.suggestion.headline}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
                  {briefing.suggestion.allocations.map((a) => (
                    <div key={a.ticker} className="bg-black/30 rounded-xl p-4 text-center border border-white/[0.04]">
                      <p className="text-xs text-gray-500 mb-1">{a.ticker}</p>
                      <p className="text-lg font-bold text-blue-400">{fmt(a.amount)}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/[0.06]">
                  <p className="text-sm text-gray-400 leading-relaxed">{briefing.suggestion.rationale}</p>
                  <div className="flex items-center gap-2 bg-white/[0.05] rounded-lg px-4 py-2 shrink-0">
                    <span className="text-xs text-gray-500">Total</span>
                    <span className="text-base font-bold text-white">
                      {fmt(briefing.suggestion.allocations.reduce((s, a) => s + a.amount, 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!briefing && !loading && !error && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <p className="text-gray-600 text-sm">Click "Generate Morning Briefing" to get your daily analysis</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
