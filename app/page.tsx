export default function Home() {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000'

  return (
    <main className="min-h-screen bg-background p-8 font-mono text-sm">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">
          CORS Anywhere Proxy
        </h1>
        
        <p className="text-muted-foreground">
          This API enables cross-origin requests to anywhere.
        </p>

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
              <code className="bg-muted px-2 py-1 rounded">/&lt;url&gt;</code> Create a request to &lt;url&gt;, and includes CORS headers in the response.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Examples:</h2>
          
          <div className="space-y-2">
            <code className="block bg-muted px-3 py-2 rounded text-foreground break-all">
              {baseUrl}/https://api.example.com/data
            </code>
            <code className="block bg-muted px-3 py-2 rounded text-foreground break-all">
              {baseUrl}/http://httpbin.org/get
            </code>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Notes:</h2>
          
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>If the protocol is omitted, it defaults to http (https if port 443 is specified).</li>
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
          <h2 className="text-lg font-semibold text-foreground">Required Headers:</h2>
          
          <p className="text-muted-foreground">
            To prevent the use of the proxy for casual browsing, the API requires either the{' '}
            <code className="bg-muted px-1 rounded">Origin</code> or the{' '}
            <code className="bg-muted px-1 rounded">X-Requested-With</code> header to be set.
          </p>
          
          <p className="text-muted-foreground">
            Browsers automatically set these headers for AJAX requests, so you don&apos;t need to set them manually.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">JavaScript Example:</h2>
          
          <pre className="bg-muted px-4 py-3 rounded overflow-x-auto text-foreground">
{`fetch('${baseUrl}/https://api.example.com/data')
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
