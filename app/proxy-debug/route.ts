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
  const forwardedHost = request.headers.get('x-forwarded-host')
  const originalHost = request.headers.get('x-original-host')
  const host = request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const protocol = forwardedProto?.split(',')[0]?.trim() || 'https'
  
  let proxyHost = forwardedHost || originalHost || host
  if (!proxyHost) {
    try {
      proxyHost = new URL(request.url).host
    } catch {
      proxyHost = 'localhost'
    }
  }
  
  const proxyBaseUrl = `${protocol}://${proxyHost}`
  
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    requestUrl: request.url,
    resolvedProxyBaseUrl: proxyBaseUrl,
    headers,
    env: {
      nodeEnv: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
    }
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
  })
}
