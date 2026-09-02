'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SimklSyncPage from '../simkl/page';

export default function TraktPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/simkl');
  }, [router]);

  return <SimklSyncPage />;
}
