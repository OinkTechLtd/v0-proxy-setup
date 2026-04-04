import { NextRequest, NextResponse } from 'next/server'

// CORS Anywhere Proxy с поддержкой HLS видеопотоков
export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, params)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, params)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, params)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, params)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, params)
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, params)
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request.headers.get('origin')),
  })
}

async function handleProxy(
  request: NextRequest,
  paramsPromise: Promise<{ path: string[] }>
) {
  const { path } = await paramsPromise
  const origin = request.headers.get('origin')
  
  // Собираем целевой URL из path
  let targetUrl = path.join('/')
  
  // Добавляем протокол если нет
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    // Проверяем на https:/ или http:/ (без двойного слэша)
    if (targetUrl.startsWith('https:/')) {
      targetUrl = 'https://' + targetUrl.substring(7)
    } else if (targetUrl.startsWith('http:/')) {
      targetUrl = 'http://' + targetUrl.substring(6)
    } else {
      targetUrl = 'https://' + targetUrl
    }
  }
  
  // Добавляем query параметры
  const searchParams = request.nextUrl.searchParams.toString()
  if (searchParams) {
    targetUrl += (targetUrl.includes('?') ? '&' : '?') + searchParams
  }

  try {
    // Формируем заголовки
    const headers = new Headers()
    
    // Копируем некоторые заголовки
    const headersToCopy = ['accept', 'accept-language', 'range', 'if-none-match', 'if-modified-since']
    headersToCopy.forEach(name => {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    })
    
    // Добавляем User-Agent
    headers.set('User-Agent', request.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

    // Получаем тело запроса
    let body: ArrayBuffer | null = null
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer()
    }

    // Выполняем запрос
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'follow',
    })

    // Определяем базовый URL для относительных путей в m3u8
    const urlObj = new URL(targetUrl)
    const baseUrl = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1)
    
    // Получаем proxy base URL
    const proxyBaseUrl = new URL(request.url).origin

    // Формируем заголовки ответа
    const responseHeaders = new Headers()
    
    // Копируем важные заголовки
    const headersToForward = [
      'content-type', 'cache-control', 'expires', 'last-modified', 
      'etag', 'accept-ranges', 'content-range'
    ]
    headersToForward.forEach(name => {
      const value = response.headers.get(name)
      if (value) responseHeaders.set(name, value)
    })

    // Добавляем CORS заголовки
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      responseHeaders.set(key, value)
    })

    responseHeaders.set('X-Request-URL', targetUrl)

    // Определяем тип контента
    const contentType = response.headers.get('content-type') || ''
    const isM3U8 = targetUrl.includes('.m3u8') || 
                   contentType.includes('mpegurl') || 
                   contentType.includes('x-mpegurl')
    
    if (isM3U8) {
      // Обрабатываем M3U8 плейлист - переписываем URL
      let text = await response.text()
      
      // Переписываем все URL в плейлисте
      text = rewriteM3U8(text, baseUrl, proxyBaseUrl)
      
      responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl')
      
      return new NextResponse(text, {
        status: response.status,
        headers: responseHeaders,
      })
    }

    // Для остальных файлов (включая .ts сегменты) - стримим напрямую
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })

  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch',
        details: error instanceof Error ? error.message : 'Unknown error',
        targetUrl 
      },
      { 
        status: 500,
        headers: getCorsHeaders(origin)
      }
    )
  }
}

function rewriteM3U8(content: string, baseUrl: string, proxyBaseUrl: string): string {
  const lines = content.split('\n')
  
  return lines.map(line => {
    const trimmed = line.trim()
    
    // Пропускаем пустые строки и комментарии (кроме URI внутри тегов)
    if (!trimmed || (trimmed.startsWith('#') && !trimmed.includes('URI='))) {
      // Обрабатываем теги с URI (например #EXT-X-KEY)
      if (trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/g, (match, uri) => {
          const fullUrl = resolveUrl(uri, baseUrl)
          return `URI="${proxyBaseUrl}/${fullUrl}"`
        })
      }
      return line
    }
    
    // Если строка начинается с #, но содержит URI
    if (trimmed.startsWith('#')) {
      if (trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/g, (match, uri) => {
          const fullUrl = resolveUrl(uri, baseUrl)
          return `URI="${proxyBaseUrl}/${fullUrl}"`
        })
      }
      return line
    }
    
    // Это URL сегмента или плейлиста
    const fullUrl = resolveUrl(trimmed, baseUrl)
    return `${proxyBaseUrl}/${fullUrl}`
  }).join('\n')
}

function resolveUrl(url: string, baseUrl: string): string {
  // Если уже абсолютный URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  
  // Если начинается с //, добавляем протокол
  if (url.startsWith('//')) {
    return 'https:' + url
  }
  
  // Если начинается с /, это абсолютный путь от корня домена
  if (url.startsWith('/')) {
    const baseUrlObj = new URL(baseUrl)
    return baseUrlObj.origin + url
  }
  
  // Относительный путь
  return baseUrl + url
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Max-Age': '86400',
  }
}
