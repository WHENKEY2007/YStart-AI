import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk' })

export const metadata = {
  title: "ProofLoop — Don't pitch assumptions. Prove them.",
  description: 'An AI-powered startup validation board that challenges your assumptions, creates evidence missions, and helps you build an investor-ready startup.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${grotesk.variable} font-sans bg-zinc-950 text-zinc-100 antialiased`}>{children}</body>
    </html>
  )
}
