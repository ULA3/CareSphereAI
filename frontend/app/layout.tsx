import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import AppShell from '@/components/ui/AppShell';

export const metadata: Metadata = {
  title: 'CareSphere AI — Elderly Health Monitoring',
  description: 'AI-powered elderly health monitoring system for Malaysia. Track 3: Vital Signs — Project 2030 MyAI Future Hackathon',
  keywords: ['healthcare', 'AI', 'elderly', 'monitoring', 'Gemini', 'Malaysia'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-app text-slate-900 min-h-screen antialiased">
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <ToastProvider>
                <AppShell>{children}</AppShell>
              </ToastProvider>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
