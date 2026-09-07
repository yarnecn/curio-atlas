import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import devConfig from './dev';
import prodConfig from './prod';

export default defineConfig(async (merge, { mode }) => {
  const baseConfig: UserConfigExport = {
    projectName: 'knowledge-map',
    date: '2026-09-02',
    designWidth: 750,
    deviceRatio: { 750: 1 },
    sourceRoot: 'src',
    outputRoot: 'dist',
    framework: 'react',
    compiler: { type: 'webpack5', prebundle: { enable: false } },
    cache: { enable: false },
    plugins: [],
    defineConstants: {},
    copy: { patterns: [], options: {} },
    mini: {
      postcss: {
        pxtransform: { enable: true, config: {} },
        url: { enable: true, config: { limit: 1024 } },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
  };

  return mode === 'development'
    ? merge({}, baseConfig, devConfig)
    : merge({}, baseConfig, prodConfig);
});
