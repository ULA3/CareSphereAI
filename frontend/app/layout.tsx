import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/ui/Sidebar';
import { LanguageProvider } from '@/contexts/LanguageContext';

export const metadata: Metadata = {
  title: 'CareSphere AI — Elderly Health Monitoring',
  description: 'AI-powered elderly health monitoring system for Malaysia. Track 3: Vital Signs — Project 2030 MyAI Future Hackathon',
  keywords: ['healthcare', 'AI', 'elderly', 'monitoring', 'Gemini', 'Malaysia'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0f1e] text-gray-100 min-h-screen">
        <LanguageProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 p-6 overflow-auto">
              {children}
            </main>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
