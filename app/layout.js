import './globals.css';

export const metadata = {
  title: 'Miss Nederland – Fotoselectie',
  description: 'Geef je gekozen headshot door.',
  robots: { index: false, follow: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d1b22',
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
