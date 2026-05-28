// ChatHistory.tsx
import { useChatStore } from '../store/chatStore';
import ChatBubble from './ChatBubble';
import { useEffect, useRef, useCallback } from 'react';
import { useLanguageStore } from '@/store/languageStore';
import { getSpeech } from '@/utils/getSpeech';
import { useVoiceStore } from '@/features/order/store/voiceStore';

const ChatHistory = () => {
  const messages = useChatStore((state) => state.messages);
  const isCapturing = useChatStore((state) => state.isCapturing);
  const { language } = useLanguageStore();

  const scrollerRef = useRef<HTMLDivElement>(null);

  const {
    isCovered,
    isMicOn,
    stopHotwordDetection,
    stopMic,
  } = useVoiceStore();

  // ✅ 정석: 스크롤 컨테이너의 scrollTop을 직접 조절
  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollerRef.current;
    if (!el) return;

    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  // ✅ 새 메시지가 "추가될 때" 1번 내려줌
  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length, scrollToBottom]);

  // 언어 바뀔 때 TTS 테스트
  useEffect(() => {
    if (isCovered) return;

    try {
      const testMessage =
        language === 'en'
          ? 'Hi! How may I help you?'
          : '안녕하세요! 어떤 도움이 필요하신가요?';

      getSpeech(testMessage, language === 'en' ? 'en' : 'ko');
    } catch (error) {
      console.error('TTS test failed:', error);
    }
  }, [language, isCovered]);

  // 화면 덮힘 상태면 자동으로 마이크/감지 끄기
  useEffect(() => {
    if (!isCovered) return;
    if (!isMicOn) return;

    stopMic?.();
    stopHotwordDetection?.();
  }, [isCovered, isMicOn, stopMic, stopHotwordDetection]);

  const lastMsg = messages[messages.length - 1];
  const shouldAutoFollow =
    !!lastMsg && !lastMsg.isUser && lastMsg.text !== 'loading';

  return (
    <div className="flex flex-col h-full relative">
      <div
        ref={scrollerRef}
        className="flex-1 px-4 pt-3 pb-1 overflow-y-auto bg-[var(--color-indigo-50)] rounded-lg"
        style={{
          boxShadow: '0 8px 16px var(--color-chat-shadow)',
          border: '1px solid var(--color-chat-border)',
        }}
      >
        {messages.length === 0 ? (
          <ChatBubble
            message={
              language === 'en'
                ? 'Hi! How may I help you?'
                : '안녕하세요! 어떤 도움이 필요하신가요?'
            }
            isUser={false}
            // ✅ 초기 안내도 타이핑이면 따라가게
            onTyping={() => scrollToBottom(false)}
            autoFollow={true}
          />
        ) : (
          messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            const autoFollow = isLast && shouldAutoFollow;

            return (
              <ChatBubble
                key={index}
                message={message.text}
                isUser={message.isUser}
                isUpdating={
                  message.isUser && isLast && isCapturing
                }
                // ✅ 정석: 타이핑(글자 추가) 때마다 바닥으로
                onTyping={() => {
                  if (autoFollow) scrollToBottom(false);
                }}
                autoFollow={autoFollow}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatHistory;
