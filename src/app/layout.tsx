import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BrainSync AI — AI-Powered Personal Knowledge Base (RAG System)',
  description: 'Upload, organize, search, and chat with your documents in real-time with precise citations and vector similarity retrieval.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#212121] text-[#ececec] antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
