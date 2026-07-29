import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Language } from '@/i18n/language';

type InkPoint = {
  x: number;
  y: number;
  t: number;
  pressure: number;
};

type InkStroke = {
  points: InkPoint[];
};

type RecognitionResponse = {
  candidates?: string[];
  recognizer?: string;
  detail?: string;
  error?: string;
};

type Props = {
  language: Language;
  onRecognized: (text: string) => void;
};

const API_URL =
  import.meta.env.VITE_HANDWRITING_API_URL ?? 'http://127.0.0.1:17832';
const RECOGNITION_DELAY_MS = 450;

const HandwritingPad = ({ language, onRecognized }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<InkStroke[]>([]);
  const activeStrokeRef = useRef<InkStroke | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const strokeStartedAtRef = useRef(0);
  const recognitionTimerRef = useRef<number | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState('빈 공간에 손가락이나 펜으로 써 주세요.');

  const configureContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const bounds = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext('2d');
    if (!context) return null;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 4;
    context.strokeStyle = '#292524';
    return context;
  }, []);

  const drawStroke = useCallback((stroke: InkStroke) => {
    const context = configureContext();
    if (!context || stroke.points.length === 0) return;

    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const point of stroke.points.slice(1)) {
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  }, [configureContext]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = configureContext();
    if (!canvas || !context) return;

    const bounds = canvas.getBoundingClientRect();
    context.clearRect(0, 0, bounds.width, bounds.height);
    strokesRef.current.forEach(drawStroke);
    if (activeStrokeRef.current) drawStroke(activeStrokeRef.current);
  }, [configureContext, drawStroke]);

  const cancelPendingRecognition = useCallback(() => {
    if (recognitionTimerRef.current !== null) {
      window.clearTimeout(recognitionTimerRef.current);
      recognitionTimerRef.current = null;
    }
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    cancelPendingRecognition();
    strokesRef.current = [];
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    setStatus('빈 공간에 손가락이나 펜으로 써 주세요.');
    redraw();
  }, [cancelPendingRecognition, redraw]);

  const recognize = useCallback(async () => {
    if (strokesRef.current.length === 0) return;

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setStatus('필기를 인식하고 있습니다…');

    try {
      const response = await fetch(`${API_URL}/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strokes: strokesRef.current,
          language,
        }),
        signal: controller.signal,
      });
      const result = (await response.json()) as RecognitionResponse;

      if (!response.ok) {
        throw new Error(result.detail ?? result.error ?? 'recognition failed');
      }

      const nextCandidates = (result.candidates ?? []).filter(Boolean);
      const firstCandidate = nextCandidates[0];

      if (firstCandidate) {
        onRecognized(firstCandidate);
        strokesRef.current = [];
        activeStrokeRef.current = null;
        redraw();
        setStatus(`"${firstCandidate}"로 인식했습니다.`);
      } else {
        setStatus('인식 결과가 없습니다. 조금 크게 다시 써 주세요.');
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setStatus('필기 인식 서버에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.');
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    }
  }, [language, onRecognized, redraw]);

  const scheduleRecognition = useCallback(() => {
    if (recognitionTimerRef.current !== null) {
      window.clearTimeout(recognitionTimerRef.current);
    }
    recognitionTimerRef.current = window.setTimeout(() => {
      recognitionTimerRef.current = null;
      void recognize();
    }, RECOGNITION_DELAY_MS);
  }, [recognize]);

  useEffect(() => {
    configureContext();
    const handleResize = () => redraw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [configureContext, redraw]);

  useEffect(() => {
    if (strokesRef.current.length > 0) scheduleRecognition();
  }, [language, scheduleRecognition]);

  useEffect(() => cancelPendingRecognition, [cancelPendingRecognition]);

  const pointFor = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ): InkPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      t: performance.now() - strokeStartedAtRef.current,
      pressure: event.pressure || 0.5,
    };
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    cancelPendingRecognition();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    strokeStartedAtRef.current = performance.now();
    activeStrokeRef.current = { points: [pointFor(event)] };
    setStatus('필기 중…');
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      activePointerRef.current !== event.pointerId ||
      !activeStrokeRef.current
    ) {
      return;
    }

    const point = pointFor(event);
    const points = activeStrokeRef.current.points;
    const previous = points[points.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < 1) return;

    points.push(point);
    redraw();
  };

  const finishStroke = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      activePointerRef.current !== event.pointerId ||
      !activeStrokeRef.current
    ) {
      return;
    }

    const stroke = activeStrokeRef.current;
    if (stroke.points.length === 1) {
      stroke.points.push({ ...stroke.points[0], x: stroke.points[0].x + 0.1 });
    }
    strokesRef.current = [...strokesRef.current, stroke];
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    redraw();
    scheduleRecognition();
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        className='h-40 w-full touch-none rounded-xl border-2 border-dashed border-border bg-white'
        aria-label='손글씨 입력 영역'
      />

      <div className='mt-2 flex min-h-9 items-center justify-between gap-3'>
        <span className='text-sm text-muted-foreground'>{status}</span>
        <button
          type='button'
          onPointerDown={(event) => event.preventDefault()}
          onClick={clearCanvas}
          className='h-9 shrink-0 rounded-lg border border-border bg-secondary px-4 text-sm font-bold'
        >
          전체 삭제
        </button>
      </div>
    </div>
  );
};

export default HandwritingPad;
