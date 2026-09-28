import type { PropsWithChildren } from 'react';
import { useError, useUnhandledRejection } from '@tarojs/taro';
import './app.css';

export default function App({ children }: PropsWithChildren) {
  // Taro's production page boundary otherwise turns render errors into a blank page.
  useError((error) => console.error('[mini-runtime] 页面运行异常', error));
  useUnhandledRejection((event) => console.error('[mini-runtime] 未处理的异步异常', event.reason));
  return children;
}
