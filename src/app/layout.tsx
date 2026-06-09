import type { Metadata } from "next"
import { Roboto, Roboto_Flex } from "next/font/google"
import "./globals.css"

// Roboto — tipo padrão do Material 3
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
})
const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-roboto-flex",
})

export const metadata: Metadata = {
  title: "Beacon",
  description: "Ferramenta interna de teste de usabilidade",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="pt-BR"
      className={`${roboto.variable} ${robotoFlex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  )
}
