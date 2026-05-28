# Dockerfile

# ========== 1. 빌드 단계 (Builder) ==========
# node 18-alpine 버전을 빌드를 위한 베이스 이미지로 사용
FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json을 먼저 복사
# (이 파일들이 변경되지 않으면 다음 빌드 시 캐시를 사용해 속도 향상)
COPY package*.json ./

# 의존성 설치
RUN npm install

# 소스 코드 전체를 복사
COPY . .

# 프로덕션용으로 빌드
RUN npm run build


# ========== 2. 실행 단계 (Runner) ==========
# node 18-alpine 버전을 최종 실행 이미지로 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 빌드 단계(builder)에서 생성된 빌드 결과물만 복사
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
# Next.js 13 이상 standalone output 사용 시 아래도 추가
# COPY --from=builder /app/next.config.mjs ./
# COPY --from=builder /app/standalone ./standalone

# 3000번 포트를 외부에 노출
EXPOSE 3000

# 컨테이너 시작 시 Next.js 서버 실행
CMD ["npm", "run", "start"]