import './globals.css'

export const metadata = {
  title: 'Dify Batch Run',
  description: 'Call Dify API in batch',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
