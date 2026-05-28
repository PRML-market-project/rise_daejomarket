import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useChatStore } from '@/features/chat/store/chatStore';
import { useVoiceStore } from '../store/voiceStore';
import { useGpt } from '../hooks/useGpt';
import { useLanguageStore } from '@/store/languageStore';
import { useParams } from 'react-router-dom';
import { useNavigationStore } from '@/store/navigationStore';

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
  const langCode = language === 'en' ? 'en-US' : 'ko-KR';
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
    try { SpeechRecognition.stopListening(); } catch {}
    setIsMicOn(false);
    setIsCapturing(false);
    setIsProcessing(false);
  }, [setIsCapturing]);

  const stopHard = useCallback(() => {
    try { SpeechRecognition.abortListening(); SpeechRecognition.stopListening(); } catch {}
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
            className={`
              w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition active:scale-95 flex-shrink-0
              ${isMicOn ? 'bg-[var(--color-red-600)] text-white animate-pulse' : 'bg-[var(--color-indigo-600)] text-white hover:bg-[var(--color-indigo-700)]'}
            `}
            title={isMicOn ? '마이크 끄기' : '마이크 켜기'}
          >
            {isMicOn ? '■' : '🎤'}
          </button>



        </>
      )}
    </div>
  );
};

export default Voice;
