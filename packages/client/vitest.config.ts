import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    // React의 development 빌드 사용 (act() 지원을 위해 필요)
    define: {
      'process.env.NODE_ENV': '"development"',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setupTests.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['node_modules/**/*', 'src/components.skip/**/*'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**/*'],
      },
    },
  })
);
