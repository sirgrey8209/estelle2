import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // React Native 컴포넌트 테스트는 별도 환경 필요 - 임시 제외
    exclude: [
      'src/components/**/*.test.tsx',
      'node_modules/**/*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**/*'],
    },
  },
});
