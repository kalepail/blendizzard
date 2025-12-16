// Cloudflare Worker API for Soroswap proxy
// Keeps the Soroswap API key secure on the server side
// Only proxies quote requests - transaction building happens client-side

interface Env {
  SOROSWAP_API_KEY: string
}

const SOROSWAP_API_URL = 'https://api.soroswap.finance'

// Mainnet token addresses
const XLM_CONTRACT = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
const USDC_CONTRACT = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'

// Supported protocols for routing
const SUPPORTED_PROTOCOLS = ['soroswap', 'aqua', 'phoenix']

interface QuoteRequest {
  amountIn: string // XLM amount in stroops (7 decimals)
  slippageBps?: number // Default 500 (5%)
}

async function handleQuote(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as QuoteRequest
    const { amountIn, slippageBps = 500 } = body

    if (!amountIn) {
      return Response.json({ error: 'amountIn is required' }, { status: 400 })
    }

    const quotePayload = {
      assetIn: XLM_CONTRACT,
      assetOut: USDC_CONTRACT,
      amount: amountIn,
      tradeType: 'EXACT_IN',
      protocols: SUPPORTED_PROTOCOLS,
      slippageBps,
    }

    const response = await fetch(`${SOROSWAP_API_URL}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.SOROSWAP_API_KEY}`,
      },
      body: JSON.stringify(quotePayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Soroswap quote error:', errorText)
      return Response.json(
        { error: 'Failed to get quote', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('Quote error:', error)
    return Response.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Only handle POST requests to /api/swap/*
    if (request.method !== 'POST') {
      return new Response(null, { status: 404 })
    }

    let response: Response

    switch (path) {
      case '/api/swap/quote':
        response = await handleQuote(request, env)
        break
      default:
        return new Response(null, { status: 404 })
    }

    // Add CORS headers to response
    const newHeaders = new Headers(response.headers)
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value)
    })

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    })
  },
}
