export const metadata = {
  title: 'LLM Assert',
  description: 'Analytics dashboard for LLM assertion testing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
