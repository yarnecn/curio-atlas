import type { ReactNode } from 'react';
import { AccountRequired } from '../../components/account-required';

export default function ContributeLayout({ children }: { children: ReactNode }) {
  return <AccountRequired>{children}</AccountRequired>;
}
