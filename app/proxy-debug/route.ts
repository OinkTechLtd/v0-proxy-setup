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
  const proxyBaseUrl = resolveProxyBaseUrl(request)
  
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


function resolveForwardedValue(value: string | null): string | null {
  if (!value) return null

  const first = value.split(',')[0]?.trim()
  return first || null
}

function resolveProxyBaseUrl(request: NextRequest): string {
  const envBase = process.env.PROXY_BASE_URL?.trim()

  if (envBase) {
    return envBase.replace(/\/$/, '')
  }

  const forwardedHost = resolveForwardedValue(request.headers.get('x-forwarded-host'))
  const host = resolveForwardedValue(request.headers.get('host'))
  const forwardedProto = resolveForwardedValue(request.headers.get('x-forwarded-proto'))

  const protocol = forwardedProto || new URL(request.url).protocol.replace(':', '') || 'https'
  const proxyHost = forwardedHost || host || new URL(request.url).host

  return `${protocol}://${proxyHost}`.replace(/\/$/, '')
}
