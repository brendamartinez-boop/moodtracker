import type {Metadata} from 'next';
import { Noto_Serif, Manrope } from 'next/font/google';
import './globals.css';

const notoSerif = Noto_Serif({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'MoodDay - Tu diario de estado de ánimo',
  description: 'Conecta con tu interior cada día.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es" className={`${notoSerif.variable} ${manrope.variable} dark`}>
      <body className="font-sans bg-[#0e0e0e] text-white antialiased selection:bg-[#69f6b8]/30 selection:text-[#69f6b8]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
