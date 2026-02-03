FROM node:20-alpine

WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm

# 루트 package.json과 workspace 설정 복사
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# 필요한 패키지만 복사
COPY packages/core/package.json ./packages/core/
COPY packages/relay/package.json ./packages/relay/

# 의존성 설치
RUN pnpm install --frozen-lockfile --prod

# 소스 복사
COPY packages/core/ ./packages/core/
COPY packages/relay/ ./packages/relay/

# 빌드
RUN pnpm --filter @estelle/core build
RUN pnpm --filter @estelle/relay build

WORKDIR /app/packages/relay

EXPOSE 8080

CMD ["node", "dist/bin.js"]
