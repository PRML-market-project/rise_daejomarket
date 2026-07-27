import { Language } from '@/i18n/language';

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let currentRequestController: AbortController | null = null;
let latestRequestId = 0;

function removeParenthesesContent(text: string) {
  return text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Cancel both the pending TTS request and the audio currently playing.
 * Incrementing latestRequestId also prevents a stale response from playing
 * if its network request cannot be cancelled in time.
 */
export const cancelSpeech = () => {
  latestRequestId += 1;
  currentRequestController?.abort();
  currentRequestController = null;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
};

/**
 * Generate and play one utterance. Only the most recently requested
 * utterance is allowed to play.
 */
export const getSpeech = async (text: unknown, language: Language = 'ko') => {
  if (!text) {
    console.warn('No text provided for speech synthesis');
    return;
  }

  const processedText = removeParenthesesContent(String(text));
  if (!processedText) {
    console.warn('Text became empty after removing parentheses content');
    return;
  }

  const requestId = latestRequestId + 1;
  latestRequestId = requestId;

  currentRequestController?.abort();
  const requestController = new AbortController();
  currentRequestController = requestController;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }

  try {
    const baseApiUrl = import.meta.env.VITE_GPT_API_URL;
    const response = await fetch(`${baseApiUrl}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify({
        text: processedText,
        language,
      }),
      signal: requestController.signal,
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    if (requestId !== latestRequestId) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    currentAudioUrl = audioUrl;

    let isUrlRevoked = false;
    const releaseAudio = () => {
      if (!isUrlRevoked) {
        URL.revokeObjectURL(audioUrl);
        isUrlRevoked = true;
      }
      if (currentAudio === audio) currentAudio = null;
      if (currentAudioUrl === audioUrl) currentAudioUrl = null;
    };

    audio.volume = 0.8;
    audio.playbackRate = 1.0;
    audio.onended = () => {
      releaseAudio();
      console.log('Speech ended:', processedText);
    };
    audio.onerror = (error) => {
      console.error('Audio playback error:', error);
      releaseAudio();
    };
    audio.onplay = () => {
      console.log('Speech started:', processedText);
    };

    if (requestId !== latestRequestId) {
      releaseAudio();
      return;
    }

    try {
      await audio.play();
    } catch (error) {
      releaseAudio();
      throw error;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    console.error('TTS API error:', error);
  } finally {
    if (currentRequestController === requestController) {
      currentRequestController = null;
    }
  }
};
