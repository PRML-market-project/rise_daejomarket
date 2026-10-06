import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Admin and kiosk share UI source files across the two app directories.
  // Next 15.3 also uses the tracing root as its Turbopack resolution root.
  outputFileTracingRoot: path.resolve(__dirname, '..'),
  images: {
    remotePatterns: [
      // 1. AWS S3 이미지 경로 (배포용)
      {
        protocol: 'https',
        hostname: 'mallangkiosk-menu-images.s3.ap-northeast-2.amazonaws.com',
        port: '',
        pathname: '/**', // S3 버킷 내 모든 경로의 이미지를 허용합니다.
      },
      // 2. 로컬 서버 이미지 경로 (개발용)
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080', // Spring Boot 백엔드 서버 포트
        pathname: '/images/**',
      },
    ],
  },
};

export default nextConfig;
