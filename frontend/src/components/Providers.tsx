'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <div className="h-full"><AuthProvider>{children}</AuthProvider></div>;
}
