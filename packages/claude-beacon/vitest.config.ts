import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // TCP 서버 테스트가 포트를 공유하므로 순차 실행 필요
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // beacon-server 테스트가 같은 포트를 사용하므로 순차 실행
    fileParallelism: false,
  },
  define: {
    'process.env.NODE_ENV': '"test"',
  },
});
