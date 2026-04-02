import { NextRequest, NextResponse } from 'next/server'

// CORS Anywhere Proxy - добавляет CORS заголовки к любым запросам
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
  // Handle preflight requests
  const origin = request.headers.get('origin') || '*'
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': request.headers.get('access-control-request-headers') || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  })
}

async function handleProxy(
  request: NextRequest,
  paramsPromise: Promise<{ path: string[] }>
) {
  const { path } = await paramsPromise
  
  // Проверяем наличие Origin или X-Requested-With заголовка
  const origin = request.headers.get('origin')
  const xRequestedWith = request.headers.get('x-requested-with')
  
  if (!origin && !xRequestedWith) {
    return NextResponse.json(
      { 
        error: 'Missing required request header. Must specify one of: origin, x-requested-with' 
      },
      { 
        status: 400,
        headers: getCorsHeaders(origin)
      }
    )
  }

  // Собираем URL из path параметров
  const pathString = path.join('/')
  
  // Парсим целевой URL
  let targetUrl: string
  
  if (pathString.startsWith('http://') || pathString.startsWith('https://')) {
    targetUrl = pathString
  } else if (pathString.includes(':443')) {
    targetUrl = 'https://' + pathString.replace(':443', '')
  } else {
    targetUrl = 'http://' + pathString
  }

  // Добавляем query параметры если есть
  const searchParams = request.nextUrl.searchParams.toString()
  if (searchParams) {
    targetUrl += '?' + searchParams
  }

  try {
    // Формируем заголовки для запроса
    const headers = new Headers()
    
    request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      // Пропускаем некоторые заголовки
      if (
        lowerKey !== 'host' &&
        lowerKey !== 'origin' &&
        lowerKey !== 'x-requested-with' &&
        lowerKey !== 'cookie' &&
        !lowerKey.startsWith('cf-') &&
        !lowerKey.startsWith('x-vercel') &&
        !lowerKey.startsWith('x-forwarded')
      ) {
        headers.set(key, value)
      }
    })

    // Получаем тело запроса если есть
    let body: BodyInit | null = null
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer()
    }

    // Выполняем запрос к целевому URL
    let response: Response
    let redirectCount = 0
    const maxRedirects = 5
    let currentUrl = targetUrl
    const redirectHeaders: Record<string, string> = {}

    while (true) {
      response = await fetch(currentUrl, {
        method: request.method,
        headers,
        body: redirectCount === 0 ? body : null,
        redirect: 'manual',
      })

      // Проверяем на редирект
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location')
      ) {
        redirectCount++
        if (redirectCount > maxRedirects) {
          break // Возвращаем последний редирект браузеру
        }
        
        const location = response.headers.get('location')!
        redirectHeaders[`X-CORS-Redirect-${redirectCount}`] = currentUrl + ' -> ' + location
        
        // Резолвим относительные URL
        currentUrl = new URL(location, currentUrl).toString()
      } else {
        break
      }
    }

    // Формируем заголовки ответа
    const responseHeaders = new Headers()
    
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      // Пропускаем некоторые заголовки
      if (
        lowerKey !== 'content-encoding' &&
        lowerKey !== 'content-length' &&
        lowerKey !== 'transfer-encoding' &&
        lowerKey !== 'connection' &&
        lowerKey !== 'set-cookie'
      ) {
        responseHeaders.set(key, value)
      }
    })

    // Добавляем CORS заголовки
    const corsHeaders = getCorsHeaders(origin)
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value)
    })

    // Добавляем информационные заголовки
    responseHeaders.set('X-Request-URL', targetUrl)
    responseHeaders.set('X-Final-URL', currentUrl)
    
    // Добавляем заголовки редиректов
    Object.entries(redirectHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value)
    })

    // Возвращаем ответ
    const responseBody = await response.arrayBuffer()
    
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch from target URL',
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

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'X-Request-URL, X-Final-URL, X-CORS-Redirect-1, X-CORS-Redirect-2, X-CORS-Redirect-3, X-CORS-Redirect-4, X-CORS-Redirect-5',
  }
}
