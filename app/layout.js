import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk' })

export const metadata = {
  title: "YStart-AI — Don't pitch assumptions. Prove them.",
  description: 'AI-powered startup validation platform that tests your idea, finds proof, and builds investor readiness.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${grotesk.variable} font-sans bg-zinc-950 text-zinc-100 antialiased`}>{children}</body>
    </html>
  )
}
