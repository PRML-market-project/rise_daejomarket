// ChatBubble.tsx
import TypingText from './TypingText';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  isUpdating?: boolean;
  onTyping?: () => void;   // ✅ 추가
  autoFollow?: boolean;    // ✅ 마지막 봇 메시지일 때만 따라가기 용도
}

export default function ChatBubble({
  message,
  isUser,
  isUpdating = false,
  onTyping,
  autoFollow = false,
}: ChatBubbleProps) {
  const isLoading = message === 'loading';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 shadow-md ${
          isUser
            ? isUpdating
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-br-none'
              : 'bg-[var(--color-secondary)] text-[var(--color-foreground)] rounded-br-none'
            : 'bg-[var(--color-indigo-100)] text-[var(--color-indigo-700)] rounded-bl-none'
        }`}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-[var(--color-indigo-300)] border-t-transparent rounded-full animate-spin" />
        ) : isUser ? (
          <span className="text-sm whitespace-pre-wrap">{message}</span>
        ) : (
          <TypingText
            text={message}
            speed={50}
            onTick={autoFollow ? onTyping : undefined} // ✅ 마지막 메시지일 때만 스크롤 호출
          />
        )}
      </div>
    </div>
  );
}
