import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/ui/Navbar';
import Sidebar from '@/components/ui/Sidebar';
import { LanguageProvider } from '@/contexts/LanguageContext';

export const metadata: Metadata = {
  title: 'CareSphere AI — Elderly Health Monitoring',
  description: 'AI-powered elderly health monitoring system for Malaysia. Track 3: Vital Signs — Project 2030 MyAI Future Hackathon',
  keywords: ['healthcare', 'AI', 'elderly', 'monitoring', 'Gemini', 'Malaysia'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-app text-slate-900 min-h-screen antialiased">
        <LanguageProvider>
          {/* Top Navbar — full width, fixed */}
          <Navbar />

          <div className="flex min-h-screen pt-16">
            {/* Left Sidebar — fixed, starts below navbar */}
            <Sidebar />

            {/* Main Content — offset for sidebar + navbar */}
            <main className="flex-1 ml-64 min-h-[calc(100vh-4rem)] p-6 overflow-auto">
              {children}
            </main>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
