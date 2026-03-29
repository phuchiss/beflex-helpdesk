'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, getStoredUser } from '@/lib/auth';

const CUSTOMER_ALLOWED = ['/dashboard', '/tickets'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    const user = getStoredUser();
    if (user?.role === 'customer') {
      const allowed = CUSTOMER_ALLOWED.some(p => pathname === p || pathname.startsWith(p + '/'));
      if (!allowed) {
        router.replace('/dashboard');
        return;
      }
    }

    setChecked(true);
  }, [router, pathname]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
