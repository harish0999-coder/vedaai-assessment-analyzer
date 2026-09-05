import './globals.css';

export const metadata = {
  title: 'VedaAI — Assessment Extraction & Answer Mapping',
  description: 'Upload a question paper and a handwritten answer sheet to extract, map, highlight, and grade answers automatically.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-paper-dim text-ink font-body antialiased">{children}</body>
    </html>
  );
}
