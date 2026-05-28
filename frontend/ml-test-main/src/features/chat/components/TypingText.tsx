// TypingText.tsx
import { useEffect, useState } from 'react';

interface TypingTextProps {
  text: string;
  speed: number; // 각 글자가 나타나는 시간 간격 (ms)
  fadeDuration?: number; // 각 글자의 페이드 인 애니메이션 지속 시간 (ms)
  onTick?: () => void; // ✅ 글자 추가될 때 호출
}

const TypingText = ({
  text,
  speed,
  fadeDuration = 200,
  onTick,
}: TypingTextProps) => {
  const [displayedChars, setDisplayedChars] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  // text prop이 변경될 때 상태 초기화
  useEffect(() => {
    setDisplayedChars([]);
    setIndex(0);
  }, [text]);

  useEffect(() => {
    if (index >= text.length) return;

    const timeout = window.setTimeout(() => {
      const charToAdd =
        text.charAt(index) === ' ' ? '\u00A0' : text.charAt(index);

      setDisplayedChars((prev) => [...prev, charToAdd]);
      setIndex((prev) => prev + 1);

      // ✅ 정석: 글자 하나 추가될 때마다 콜백
      onTick?.();
    }, speed);

    return () => window.clearTimeout(timeout);
  }, [index, text, speed, onTick]);

  return (
    <span className="text-sm whitespace-pre-wrap">
      {displayedChars.map((char, charIdx) => (
        <span
          key={charIdx}
          className="inline-block animate-fadeIn"
          style={{
            animationDuration: `${fadeDuration}ms`,
            animationTimingFunction: 'ease-out',
          }}
          dangerouslySetInnerHTML={{ __html: char }}
        />
      ))}
    </span>
  );
};

export default TypingText;
