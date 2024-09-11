import './globals.css'

export const metadata = {
  title: 'CSV API Processor',
  description: 'Process CSV files with API calls',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
