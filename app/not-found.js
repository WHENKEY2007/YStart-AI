import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-100">
      <h1 className="text-6xl font-bold text-emerald-400">404</h1>
      <h2 className="mt-4 text-2xl font-semibold">Page Not Found</h2>
      <p className="mt-2 text-sm text-zinc-400">The page you are looking for does not exist.</p>
      <Link href="/" className="mt-6 rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">
        Back to War Room
      </Link>
    </div>
  )
}
