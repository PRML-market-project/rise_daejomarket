import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Language } from '@/i18n/language';

type Stroke = {
  addPoint: (point: { x: number; y: number; t: number }) => void;
};

type Drawing = {
  addStroke: (stroke: Stroke) => void;
  getPrediction: () => Promise<Array<{ text: string }>>;
  clear: () => void;
};

type Recognizer = {
  startDrawing: (hints: {
    recognitionType: string;
    inputType: string;
    alternatives: number;
  }) => Drawing;
  finish: () => void;
};

type HandwritingNavigator = Navigator & {
  createHandwritingRecognizer?: (constraints: {
    languages: string[];
  }) => Promise<Recognizer>;
};

type HandwritingWindow = Window & {
  HandwritingStroke?: new () => Stroke;
};

type Props = {
  language: Language;
  onRecognized: (text: string) => void;
};

const HandwritingPad = ({ language, onRecognized }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const drawingRef = useRef<Drawing | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const strokeStartedAtRef = useRef(0);
  const drawingPointerRef = useRef(false);
  const [predictions, setPredictions] = useState<string[]>([]);
  const [status, setStatus] = useState('손가락이나 펜으로 글씨를 써 주세요.');

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    drawingRef.current?.clear();
    drawingRef.current = null;
    activeStrokeRef.current = null;
    setPredictions([]);
    setStatus('손가락이나 펜으로 글씨를 써 주세요.');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      const context = canvas.getContext('2d');
      context?.scale(ratio, ratio);
      if (context) {
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = 4;
        context.strokeStyle = '#292524';
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let disposed = false;
    const handwritingNavigator = navigator as HandwritingNavigator;
    const initialize = async () => {
      if (!handwritingNavigator.createHandwritingRecognizer) {
        setStatus('이 기기에서는 손글씨 인식을 지원하지 않습니다.');
        return;
      }
      try {
        const recognizer = await handwritingNavigator.createHandwritingRecognizer({
          languages: [language],
        });
        if (disposed) {
          recognizer.finish();
          return;
        }
        recognizerRef.current = recognizer;
        setStatus('손가락이나 펜으로 글씨를 써 주세요.');
      } catch {
        setStatus('현재 선택한 언어의 손글씨 인식을 지원하지 않습니다.');
      }
    };
    void initialize();
    return () => {
      disposed = true;
      recognizerRef.current?.finish();
      recognizerRef.current = null;
    };
  }, [language]);

  const pointFor = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingPointerRef.current = true;
    const point = pointFor(event);
    const context = event.currentTarget.getContext('2d');
    context?.beginPath();
    context?.moveTo(point.x, point.y);

    const StrokeConstructor = (window as HandwritingWindow).HandwritingStroke;
    if (recognizerRef.current && StrokeConstructor) {
      drawingRef.current ??= recognizerRef.current.startDrawing({
        recognitionType: 'text',
        inputType: ['mouse', 'touch', 'stylus'].includes(event.pointerType)
          ? event.pointerType
          : 'touch',
        alternatives: 4,
      });
      activeStrokeRef.current = new StrokeConstructor();
      strokeStartedAtRef.current = performance.now();
      activeStrokeRef.current.addPoint({ ...point, t: 0 });
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingPointerRef.current) return;
    const point = pointFor(event);
    const context = event.currentTarget.getContext('2d');
    context?.lineTo(point.x, point.y);
    context?.stroke();
    activeStrokeRef.current?.addPoint({
      ...point,
      t: performance.now() - strokeStartedAtRef.current,
    });
  };

  const handlePointerUp = async () => {
    drawingPointerRef.current = false;
    if (!activeStrokeRef.current || !drawingRef.current) return;
    drawingRef.current.addStroke(activeStrokeRef.current);
    activeStrokeRef.current = null;
    setStatus('인식 중…');
    try {
      const result = await drawingRef.current.getPrediction();
      const texts = result.map((item) => item.text).filter(Boolean);
      setPredictions(texts);
      setStatus(texts.length ? '인식 결과를 선택해 주세요.' : '다시 써 주세요.');
    } catch {
      setStatus('인식하지 못했습니다. 다시 써 주세요.');
    }
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => void handlePointerUp()}
        onPointerCancel={() => {
          drawingPointerRef.current = false;
          activeStrokeRef.current = null;
        }}
        className='h-36 w-full touch-none rounded-xl border-2 border-dashed border-border bg-white'
        aria-label='손글씨 입력 영역'
      />
      <div className='mt-2 flex min-h-9 items-center justify-between gap-3'>
        <span className='text-sm text-muted-foreground'>{status}</span>
        <button
          type='button'
          onClick={clearCanvas}
          className='h-9 shrink-0 rounded-lg border border-border bg-secondary px-4 text-sm font-bold'
        >
          전체 삭제
        </button>
      </div>
      {predictions.length > 0 && (
        <div className='mt-2 flex gap-2 overflow-x-auto'>
          {predictions.map((prediction) => (
            <button
              key={prediction}
              type='button'
              onClick={() => {
                onRecognized(prediction);
                clearCanvas();
              }}
              className='h-10 shrink-0 rounded-full bg-primary px-5 font-bold text-primary-foreground'
            >
              {prediction}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HandwritingPad;
