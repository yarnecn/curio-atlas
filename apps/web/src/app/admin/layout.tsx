import type { ReactNode } from 'react';
import { AdminGuard } from '../../components/admin-guard';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
