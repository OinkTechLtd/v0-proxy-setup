import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Собираем информацию о заголовках для диагностики
  const headers: Record<string, string> = {}
  
  const importantHeaders = [
    'host',
    'x-forwarded-host',
    'x-original-host',
    'x-forwarded-proto',
    'x-forwarded-for',
    'x-real-ip',
    'user-agent',
    'origin',
    'referer'
  ]
  
  importantHeaders.forEach(name => {
    const value = request.headers.get(name)
    if (value) headers[name] = value
  })
  
  // Определяем конечный proxy base URL
  let proxyBaseUrl = process.env.PROXY_BASE_URL
  
  if (!proxyBaseUrl) {
    const forwardedHost = request.headers.get('x-forwarded-host')
    const host = request.headers.get('host')
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const protocol = forwardedProto?.split(',')[0]?.trim() || 'https'
    const proxyHost = forwardedHost || host || new URL(request.url).host
    proxyBaseUrl = `${protocol}://${proxyHost}`
  }
  
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    requestUrl: request.url,
    resolvedProxyBaseUrl: proxyBaseUrl,
    proxyBaseUrlSource: process.env.PROXY_BASE_URL ? 'PROXY_BASE_URL env var' : 'auto-detected from headers',
    headers,
    env: {
      nodeEnv: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
      proxyBaseUrlEnv: process.env.PROXY_BASE_URL || '(not set)',
    },
    instructions: !process.env.PROXY_BASE_URL ? 
      'Set PROXY_BASE_URL environment variable to fix custom domain issues. Example: PROXY_BASE_URL=https://your-domain.com' : 
      'PROXY_BASE_URL is configured correctly'
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
  })
}
