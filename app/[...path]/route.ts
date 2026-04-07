import { NextRequest, NextResponse } from 'next/server'

// CORS Anywhere Proxy для HLS и видеопотоков
// Для кастомных доменов установите PROXY_BASE_URL в переменных окружения
// Например: PROXY_BASE_URL=https://proxyvideo.tatnet.app
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

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
    headers: getCorsHeaders(),
  })
}

async function handleProxy(
  request: NextRequest,
  paramsPromise: Promise<{ path: string[] }>
) {
  const { path } = await paramsPromise
  
  // Собираем целевой URL из path
  let targetUrl = path.join('/')
  
  // Исправляем протокол
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    if (targetUrl.startsWith('https:/')) {
      targetUrl = 'https://' + targetUrl.substring(7)
    } else if (targetUrl.startsWith('http:/')) {
      targetUrl = 'http://' + targetUrl.substring(6)
    } else {
      targetUrl = 'https://' + targetUrl
    }
  }
  
  // Добавляем query-параметры, исключая служебные параметры прокси
  const passthroughQuery = buildPassthroughQuery(request.nextUrl.searchParams)
  if (passthroughQuery) {
    targetUrl += (targetUrl.includes('?') ? '&' : '?') + passthroughQuery
  }

  try {
    // Формируем заголовки запроса
    const headers = new Headers()
    
    // Копируем важные заголовки
    const headersToCopy = [
      'accept', 
      'accept-language', 
      'range',
      'if-none-match', 
      'if-modified-since',
      'if-range'
    ]
    
    headersToCopy.forEach(name => {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    })
    
    headers.set('User-Agent', request.headers.get('user-agent') || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    // Тело запроса для POST/PUT/PATCH
    let body: ArrayBuffer | null = null
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer()
    }

    // Выполняем запрос с retry для временных сбоев сети
    const response = await fetchWithRetry(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'follow',
    })

    // Определяем базовый URL для относительных путей.
    // Важно использовать final URL после redirect, иначе relative URI из плейлиста ломаются.
    const finalUrlObj = new URL(response.url || targetUrl)
    const baseUrl = new URL('.', finalUrlObj).toString()
    
    // Определяем базовый URL прокси
    // ВАЖНО: На кастомных хостингах (Yandex Cloud, и т.д.) установите PROXY_BASE_URL
    const proxyBaseUrl = resolveProxyBaseUrl(request)

    // Формируем заголовки ответа
    const responseHeaders = new Headers()
    
    // Копируем все важные заголовки от исходного сервера
    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
      'date'
    ]
    
    headersToForward.forEach(name => {
      const value = response.headers.get(name)
      if (value) responseHeaders.set(name, value)
    })

    // Добавляем CORS заголовки
    Object.entries(getCorsHeaders()).forEach(([key, value]) => {
      responseHeaders.set(key, value)
    })

    // Метаданные прокси
    responseHeaders.set('X-Proxy-URL', targetUrl)
    responseHeaders.set('X-Final-URL', response.url)

    // Определяем тип контента
    const contentType = response.headers.get('content-type') || ''
    const lowerUrl = targetUrl.toLowerCase()
    
    // Проверяем является ли это M3U/M3U8 плейлистом
    const isPlaylist = lowerUrl.endsWith('.m3u8') || 
                       lowerUrl.endsWith('.m3u') ||
                       contentType.includes('mpegurl') || 
                       contentType.includes('x-mpegurl') ||
                       contentType.includes('audio/x-mpegurl')
    
    if (isPlaylist) {
      // Для live HLS - отключаем кеширование чтобы плеер мог получать обновления
      responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      responseHeaders.set('Pragma', 'no-cache')
      responseHeaders.set('Expires', '0')
      
      // Обрабатываем плейлист - переписываем URL
      let text = await response.text()
      text = rewritePlaylist(text, baseUrl, proxyBaseUrl)
      
      // Устанавливаем правильный Content-Type
      const playlistContentType = lowerUrl.endsWith('.m3u') 
        ? 'audio/x-mpegurl' 
        : 'application/vnd.apple.mpegurl'
      
      responseHeaders.set('Content-Type', playlistContentType)
      responseHeaders.delete('content-length')
      
      return new NextResponse(text, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    }

    // Для .ts сегментов - разрешаем кеширование на короткое время
    const isSegment = lowerUrl.endsWith('.ts') || 
                      lowerUrl.endsWith('.aac') || 
                      lowerUrl.endsWith('.m4s') ||
                      lowerUrl.endsWith('.fmp4')
    
    if (isSegment) {
      // Кешируем сегменты на 5 минут - они не меняются после создания
      responseHeaders.set('Cache-Control', 'public, max-age=300')
    }

    // Для видеофайлов
    const isVideo = lowerUrl.endsWith('.mp4') || 
                    lowerUrl.endsWith('.webm') || 
                    lowerUrl.endsWith('.mkv') ||
                    lowerUrl.endsWith('.avi') ||
                    lowerUrl.endsWith('.mov')
    
    if (isVideo) {
      // Поддержка Range requests для seek
      responseHeaders.set('Accept-Ranges', 'bytes')
    }

    // Проверяем что есть тело ответа
    if (!response.body) {
      return new NextResponse(null, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    }

    // Стримим тело ответа напрямую
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch',
        message: error instanceof Error ? error.message : 'Unknown error',
        url: targetUrl 
      },
      { 
        status: 502,
        headers: getCorsHeaders()
      }
    )
  }
}

function buildPassthroughQuery(searchParams: URLSearchParams): string {
  const proxiedParams = new URLSearchParams()

  // Некоторые клиенты передают URL в ?path=... или ?url=...
  // Эти параметры нужны самому клиенту и не должны пробрасываться на upstream.
  const internalKeys = new Set(['path', 'url'])

  searchParams.forEach((value, key) => {
    if (!internalKeys.has(key.toLowerCase())) {
      proxiedParams.append(key, value)
    }
  })

  return proxiedParams.toString()
}

async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const attempts = 3

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(`Timeout at attempt ${attempt}`), 15000)

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!isRetryableStatus(response.status) || attempt === attempts) {
        return response
      }
    } catch (error) {
      clearTimeout(timeout)

      if (attempt === attempts || !isRetryableError(error)) {
        throw error
      }
    }

    await wait(attempt * 300)
  }

  throw new Error('Failed to fetch after retries')
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599)
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.name === 'AbortError' ||
    error.name === 'TypeError' ||
    error.message.toLowerCase().includes('network')
  )
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function rewritePlaylist(content: string, baseUrl: string, proxyBaseUrl: string): string {
  const lines = content.split('\n')
  
  return lines.map(line => {
    const trimmed = line.trim()
    
    // Пустые строки оставляем
    if (!trimmed) return line
    
    // Обрабатываем теги с URI (EXT-X-KEY, EXT-X-MAP, и т.д.)
    if (trimmed.includes('URI="')) {
      return line.replace(/URI="([^"]+)"/g, (match, uri) => {
        const fullUrl = resolveUrl(uri, baseUrl)
        return `URI="${proxyBaseUrl}/${fullUrl}"`
      })
    }
    
    // Комментарии и директивы оставляем как есть
    if (trimmed.startsWith('#')) {
      return line
    }
    
    // Это URL сегмента или вложенного плейлиста
    const fullUrl = resolveUrl(trimmed, baseUrl)
    return `${proxyBaseUrl}/${fullUrl}`
  }).join('\n')
}

function resolveUrl(url: string, baseUrl: string): string {
  // Абсолютный URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // Protocol-relative URL
  if (url.startsWith('//')) {
    return 'https:' + url
  }

  // Универсальное и RFC-совместимое разрешение относительных путей:
  // поддерживает ../, ./, query-only (?token=...), hash и абсолютные пути.
  return new URL(url, baseUrl).toString()
}

function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Accept-Ranges, X-Proxy-URL, X-Final-URL',
    'Access-Control-Max-Age': '86400',
  }
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

  // На разных платформах X-Forwarded-* может содержать несколько значений через запятую
  const forwardedHost = resolveForwardedValue(request.headers.get('x-forwarded-host'))
  const host = resolveForwardedValue(request.headers.get('host'))
  const forwardedProto = resolveForwardedValue(request.headers.get('x-forwarded-proto'))

  const protocol = forwardedProto || new URL(request.url).protocol.replace(':', '') || 'https'
  const proxyHost = forwardedHost || host || new URL(request.url).host

  return `${protocol}://${proxyHost}`.replace(/\/$/, '')
}
