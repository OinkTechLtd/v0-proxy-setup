import { NextResponse } from 'next/server'

// Этот эндпоинт НЕ включает CORS заголовки
// Используется для проверки, нужен ли CORS прокси

export async function GET() {
  return new NextResponse('no', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
