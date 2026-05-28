// 현재 재생 중인 오디오를 추적하기 위한 변수
let currentAudio: HTMLAudioElement | null = null;

/**
 * 괄호 안 내용 제거: "(...)" 부분만 제거하고 나머지는 유지
 * 예) "김밥(추천) 주세요" -> "김밥 주세요"
 */
function removeParenthesesContent(text: string) {
  return text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * 오픈소스 TTS API를 사용하여 텍스트를 음성으로 변환하고 재생합니다.
 * @param text - 음성으로 변환할 텍스트
 * @param language - 언어 코드 ('ko' 또는 'en')
 */
export const getSpeech = async (text: any, language: 'ko' | 'en' = 'ko') => {
  if (!text) {
    console.warn('No text provided for speech synthesis');
    return;
  }

  // ✅ 괄호 안 내용 제거한 텍스트로 TTS 실행
  const processedText = removeParenthesesContent(String(text));
  if (!processedText) {
    console.warn('Text became empty after removing parentheses content');
    return;
  }

  try {
    // 이전 재생 중인 오디오가 있으면 중지
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }

    // TTS API URL (환경 변수에서 가져오거나 기본값 사용)
    const baseApiUrl = import.meta.env.VITE_GPT_API_URL;
    const ttsApiUrl = `${baseApiUrl}/api/tts`;

    // API 요청
    const response = await fetch(ttsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify({
        text: processedText, // ✅ 여기서 processedText 사용
        language: language === 'ko' ? 'ko' : 'en',
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
    }

    // 오디오 데이터를 Blob으로 받기
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // 오디오 재생
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    audio.volume = 0.08; // 볼륨
    audio.playbackRate = 1.2; // 말 속도

    // 재생 완료 시 URL 해제
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      console.log('Speech ended:', processedText);
    };

    audio.onerror = (error) => {
      console.error('Audio playback error:', error);
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };

    audio.onplay = () => {
      console.log('Speech started:', processedText);
    };

    await audio.play();
  } catch (error) {
    console.error('TTS API error:', error);

    // API 실패 시 폴백으로 크롬 웹 TTS 사용 (선택사항)
    // 주석을 해제하면 API 실패 시 자동으로 크롬 TTS로 전환됩니다.
    /*
    console.log('Falling back to browser TTS...');
    fallbackToBrowserTTS(processedText, language); // ✅ processedText로 폴백도 동일 처리
    */
  }
};

/**
 * 폴백용 브라우저 TTS 함수 (필요시 사용)
 */
function fallbackToBrowserTTS(text: string, language: 'ko' | 'en') {
  if (!('speechSynthesis' in window)) {
    console.error('Speech synthesis not supported');
    return;
  }

  // 이전 재생 중지
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  const lang = language === 'ko' ? 'ko-KR' : 'en-US';

  // ✅ 폴백에서도 괄호 안 내용 제거 유지
  const processedText = removeParenthesesContent(text);
  if (!processedText) {
    console.warn('Text became empty after removing parentheses content');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(processedText);
  utterance.lang = lang;
  utterance.volume = 0.3;
  utterance.rate = 1.2;

  window.speechSynthesis.speak(utterance);
}
