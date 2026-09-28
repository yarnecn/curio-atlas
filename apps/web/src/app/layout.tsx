import '@knowledge-map/design-tokens/tokens.css';
import './styles.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '常识地图',
  description: '打开即看的主动推荐型常识百科。',
  icons: { icon: '/curio-atlas-logo.png' },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <footer className="site-footer">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
            冀ICP备2026037293号
          </a>
        </footer>
      </body>
    </html>
  );
}
