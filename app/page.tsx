'use client'

import { useState } from 'react'

export default function Home() {
  const [testUrl, setTestUrl] = useState('https://httpbin.org/get')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTest = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    
    try {
      const proxyUrl = `/api/${testUrl}`
      console.log('[v0] Testing proxy with URL:', proxyUrl)
      
      const response = await fetch(proxyUrl, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      
      const text = await response.text()
      
      // Показываем заголовки
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })
      
      setResult(JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        headers,
        body: text.substring(0, 2000)
      }, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background p-8 font-mono text-sm">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">
          CORS Anywhere Proxy
        </h1>
        
        <p className="text-muted-foreground">
          This API enables cross-origin requests to anywhere.
        </p>

        <section className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
          <h2 className="text-lg font-semibold text-foreground">Test the Proxy:</h2>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="https://httpbin.org/get"
              className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground"
            />
            <button
              onClick={handleTest}
              disabled={loading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Test'}
            </button>
          </div>
          
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded">
              Error: {error}
            </div>
          )}
          
          {result && (
            <pre className="p-3 bg-muted rounded overflow-auto max-h-96 text-xs">
              {result}
            </pre>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Usage:</h2>
          
          <div className="space-y-2 text-muted-foreground">
            <p>
              <code className="bg-muted px-2 py-1 rounded">/</code> Shows help
            </p>
            <p>
              <code className="bg-muted px-2 py-1 rounded">/iscorsneeded</code> This is the only resource on this host which is served without CORS headers.
            </p>
            <p>
              <code className="bg-muted px-2 py-1 rounded">/api/&lt;url&gt;</code> Create a request to &lt;url&gt;, and includes CORS headers in the response.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Examples:</h2>
          
          <div className="space-y-2">
            <code className="block bg-muted px-3 py-2 rounded text-foreground break-all">
              /api/https://api.example.com/data
            </code>
            <code className="block bg-muted px-3 py-2 rounded text-foreground break-all">
              /api/https://httpbin.org/get
            </code>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Notes:</h2>
          
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>If the protocol is omitted, it defaults to https.</li>
            <li>Cookies are disabled and stripped from requests.</li>
            <li>
              Redirects are automatically followed. For debugging purposes, each followed redirect results 
              in the addition of a <code className="bg-muted px-1 rounded">X-CORS-Redirect-n</code> header, where n starts at 1.
            </li>
            <li>After 5 redirects, redirects are not followed any more.</li>
            <li>
              The requested URL is available in the <code className="bg-muted px-1 rounded">X-Request-URL</code> response header.
            </li>
            <li>
              The final URL, after following all redirects, is available in the <code className="bg-muted px-1 rounded">X-Final-URL</code> response header.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">JavaScript Example:</h2>
          
          <pre className="bg-muted px-4 py-3 rounded overflow-x-auto text-foreground">
{`fetch('/api/https://api.example.com/data', {
  headers: {
    'X-Requested-With': 'XMLHttpRequest'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`}
          </pre>
        </section>

        <footer className="pt-8 border-t border-border text-muted-foreground">
          <p>
            Based on{' '}
            <a 
              href="https://github.com/Rob--W/cors-anywhere" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              CORS Anywhere
            </a>
            {' '}by Rob Wu
          </p>
        </footer>
      </div>
    </main>
  )
}
