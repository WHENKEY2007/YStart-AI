'use client'

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-100 font-sans">
        <h2 className="text-2xl font-bold text-red-400">Application Error</h2>
        <p className="mt-2 text-sm text-zinc-400">{error?.message || 'A critical error occurred.'}</p>
        <button
          onClick={() => reset()}
          className="mt-6 rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          Reload
        </button>
      </body>
    </html>
  )
}
