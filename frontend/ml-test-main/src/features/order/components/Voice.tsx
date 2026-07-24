import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useLayoutEffect,
  type FormEvent,
} from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useChatStore } from '@/features/chat/store/chatStore';
import { useVoiceStore } from '../store/voiceStore';
import { useGpt } from '../hooks/useGpt';
import { useLanguageStore } from '@/store/languageStore';
import { useParams } from 'react-router-dom';
import { useNavigationStore } from '@/store/navigationStore';
import { speechRecognitionLocales } from '@/i18n/language';

const apiUrl = import.meta.env.VITE_GPT_API_URL;

const Voice = () => {
  const { listening, transcript, resetTranscript } = useSpeechRecognition();
  const { isCovered, setIsCovered } = useVoiceStore();
  const { resetNavigation } = useNavigationStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedText, setCapturedText] = useState('');
  const [isMicOn, setIsMicOn] = useState(false);

  const lastTextTimeRef = useRef<number>(0);
  const isSendingRef = useRef(false);
  const latestTextRef = useRef<string>('');

  const { adminId, kioskId } = useParams();
  const { language } = useLanguageStore();
  const langCode = speechRecognitionLocales[language];
  const [devInput, setDevInput] = useState('');

  const addMessage = useChatStore((state) => state.addMessage);
  const updateLastMessage = useChatStore((state) => state.updateLastMessage);
  const setIsCapturing = useChatStore((state) => state.setIsCapturing);
  const isCapturing = useChatStore((state) => state.isCapturing);

  const { sendTextToApi } = useGpt({ apiUrl });

  useLayoutEffect(() => {
    resetNavigation();
    setIsCovered(true);
  }, [resetNavigation, setIsCovered]);

  useEffect(() => {
    if (isCovered) resetNavigation();
  }, [isCovered, resetNavigation]);

  const stopSoft = useCallback(() => {
    try {
      SpeechRecognition.stopListening();
    } catch (error) {
      console.warn('Failed to stop speech recognition:', error);
    }
    setIsMicOn(false);
    setIsCapturing(false);
    setIsProcessing(false);
  }, [setIsCapturing]);

  const stopHard = useCallback(() => {
    try {
      SpeechRecognition.abortListening();
      SpeechRecognition.stopListening();
    } catch (error) {
      console.warn('Failed to abort speech recognition:', error);
    }
    setIsMicOn(false);
    setIsCapturing(false);
    setIsProcessing(false);
  }, [setIsCapturing]);

  const handleToggleMic = useCallback(async () => {
    try {
      if (isMicOn || listening || isCapturing) {
        stopSoft();
        await new Promise((r) => setTimeout(r, 250));

        const text = (latestTextRef.current || capturedText || transcript || '').trim();
        if (text && adminId && kioskId) {
          await sendTextToApi(text, adminId, kioskId);
        }
        resetTranscript();
        setCapturedText('');
        latestTextRef.current = '';
        return;
      }

      resetTranscript();
      setIsCapturing(true);
      setIsProcessing(true);
      setCapturedText('');
      latestTextRef.current = '';
      lastTextTimeRef.current = Date.now();

      addMessage({ text: '...', isUser: true, timestamp: Date.now() });
      SpeechRecognition.startListening({ continuous: true, language: langCode, interimResults: true });
      setIsMicOn(true);
    } catch (e) {
      console.error('Mic toggle failed:', e);
      stopHard();
    }
  }, [
    isMicOn, listening, isCapturing, langCode, resetTranscript, setIsCapturing, addMessage,
    capturedText, transcript, adminId, kioskId, sendTextToApi, stopSoft, stopHard
  ]);

  const runDevAsIfWebSpeech = useCallback(async (fullText: string) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    const now = Date.now();

    setIsProcessing(true);
    setIsCapturing(true);
    setCapturedText('');
    latestTextRef.current = '';
    lastTextTimeRef.current = now;

    addMessage({ text: '', isUser: true, timestamp: now });
    updateLastMessage(fullText);

    setCapturedText(fullText);
    latestTextRef.current = fullText;
    lastTextTimeRef.current = Date.now();

    try {
      if (adminId && kioskId) await sendTextToApi(fullText, adminId, kioskId);
    } catch (err) {
      console.error(err);
    } finally {
      isSendingRef.current = false;
      setIsCapturing(false);
      setIsProcessing(false);
      resetTranscript();
      setCapturedText('');
      latestTextRef.current = '';
    }
  }, [addMessage, updateLastMessage, sendTextToApi, adminId, kioskId, resetTranscript, setIsCapturing]);

  const handleTextSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = devInput.trim();
    if (!text || isProcessing || isMicOn || listening || isCapturing) return;

    setDevInput('');
    await runDevAsIfWebSpeech(text);
  }, [devInput, isProcessing, isMicOn, listening, isCapturing, runDevAsIfWebSpeech]);

  useEffect(() => {
    if (!isCapturing) return;
    const currentText = (transcript || '').trim();
    if (currentText) {
      lastTextTimeRef.current = Date.now();
      setCapturedText(currentText);
      latestTextRef.current = currentText;
      updateLastMessage(currentText);
    }
  }, [transcript, isCapturing, updateLastMessage]);

  useEffect(() => {
    if (!isCapturing) return;
    const checkInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastTextTimeRef.current > 2000) {
        stopSoft();
        const text = (latestTextRef.current || capturedText || transcript || '').trim();
        if (text && adminId && kioskId) {
          sendTextToApi(text, adminId, kioskId).catch((err) => console.error(err));
        } else {
          resetTranscript();
        }
        resetTranscript();
        setCapturedText('');
        latestTextRef.current = '';
      }
    }, 100);
    return () => clearInterval(checkInterval);
  }, [isCapturing, capturedText, transcript, sendTextToApi, adminId, kioskId, resetTranscript, stopSoft]);

  useEffect(() => {
    return () => { stopHard(); };
  }, [stopHard]);

  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 p-2">
      {/* ✅ 커버는 완전 불투명으로: 밑에 내용이 절대 비치지 않게 */}
      {isCovered && (
        <div
          className="fixed top-0 left-0 w-screen h-screen flex flex-col items-center justify-center bg-white z-[9999] cursor-pointer"
          onClick={() => {
            resetNavigation();
            setIsCovered(false);
          }}
        >
          <p className="text-4xl font-bold text-[var(--color-indigo-600)] animate-pulse">
            터치하여 시작
          </p>
        </div>
      )}

      {/* 커버가 꺼진 이후에만 나머지 UI를 보여줌 */}
      {!isCovered && (
        <>
          <button
            type="button"
            onClick={handleToggleMic}
            disabled={isSendingRef.current}
            className={`
              w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition active:scale-95 flex-shrink-0
              ${isMicOn ? 'bg-[var(--color-red-600)] text-white animate-pulse' : 'bg-[var(--color-indigo-600)] text-white hover:bg-[var(--color-indigo-700)]'}
              disabled:cursor-not-allowed disabled:opacity-50
            `}
            title={isMicOn ? '마이크 끄기' : '마이크 켜기'}
          >
            {isMicOn ? '■' : '🎤'}
          </button>

          <form
            onSubmit={handleTextSubmit}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={devInput}
              onChange={(event) => setDevInput(event.target.value)}
              placeholder="텍스트로 입력"
              aria-label="텍스트 명령 입력"
              disabled={isProcessing || isMicOn || listening || isCapturing}
              className="
                w-52 rounded-lg border border-[var(--color-gray-300)] bg-white
                px-3 py-2 text-sm text-[var(--color-gray-900)] outline-none
                placeholder:text-[var(--color-gray-400)]
                focus:border-[var(--color-indigo-600)] focus:ring-2 focus:ring-[var(--color-indigo-100)]
                disabled:cursor-not-allowed disabled:bg-[var(--color-gray-100)] disabled:opacity-70
              "
            />
            <button
              type="submit"
              disabled={!devInput.trim() || isProcessing || isMicOn || listening || isCapturing}
              className="
                rounded-lg bg-[var(--color-indigo-600)] px-4 py-2 text-sm font-semibold text-white
                transition hover:bg-[var(--color-indigo-700)] active:scale-95
                disabled:cursor-not-allowed disabled:opacity-50
              "
            >
              전송
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default Voice;
