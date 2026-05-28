type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
};

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}

export async function fetchWithToken(url: string, options: FetchOptions = {}) {
  const accessToken = getCookie('accessToken');

  // 기본 헤더 설정
  const headers = {
    ...(options.headers || {}), // 먼저 사용자 정의 헤더를 spread
    access: `${accessToken}`, // 그 다음 access 토큰 추가
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // 쿠키를 포함하여 요청
    });

    // access token이 만료된 경우 (500 에러)
    if (!response.ok) {
      console.log(response);
    }

    return response;
  } catch (error) {
    throw error;
  }
}
