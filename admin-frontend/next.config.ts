import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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