import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface Point {
  x: number;
  y: number;
}

const MAP_WIDTH = 6807;
const MAP_HEIGHT = 10577;

// The market corridor is the required area of interest. Keeping the viewport
// center inside this boundary prevents users from panning to surrounding areas
// while leaving the market itself completely off-screen.
const MARKET_BOUNDS = {
  minX: 4050,
  maxX: 5250,
  minY: 1350,
  maxY: 10050,
};

const INITIAL_CENTER: Point = { x: 4950, y: 4300 };
const MIN_LABEL_PT = 15;
const MAX_LABEL_PT = 32;
const INITIAL_LABEL_PT = 18;
const CSS_PIXELS_PER_POINT = 4 / 3;
const SOURCE_LABEL_HEIGHT = 38;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampCenter(point: Point): Point {
  return {
    x: clamp(point.x, MARKET_BOUNDS.minX, MARKET_BOUNDS.maxX),
    y: clamp(point.y, MARKET_BOUNDS.minY, MARKET_BOUNDS.maxY),
  };
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<{ midpoint: Point; distance: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });
  const [center, setCenter] = useState<Point>(INITIAL_CENTER);
  const [labelPt, setLabelPt] = useState(INITIAL_LABEL_PT);
  const [isDragging, setIsDragging] = useState(false);

  const mapScale = (labelPt * CSS_PIXELS_PER_POINT) / SOURCE_LABEL_HEIGHT;
  const viewWidth = containerSize.width / mapScale;
  const viewHeight = containerSize.height / mapScale;

  const constrainedCenter = useMemo(
    () => clampCenter(center),
    [center],
  );

  const viewBox = `${constrainedCenter.x - viewWidth / 2} ${
    constrainedCenter.y - viewHeight / 2
  } ${viewWidth} ${viewHeight}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCenter((current) => clampCenter(current));
  }, [viewHeight, viewWidth]);

  const changeZoom = useCallback((nextLabelPt: number) => {
    setLabelPt(clamp(nextLabelPt, MIN_LABEL_PT, MAX_LABEL_PT));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setLabelPt((current) =>
        clamp(
          current * Math.exp(-event.deltaY * 0.0015),
          MIN_LABEL_PT,
          MAX_LABEL_PT,
        ),
      );
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  const panBy = useCallback(
    (deltaX: number, deltaY: number) => {
      setCenter((current) =>
        clampCenter({
          x: current.x - deltaX / mapScale,
          y: current.y - deltaY / mapScale,
        }),
      );
    },
    [mapScale],
  );

  const updateGesture = useCallback(() => {
    const pointers = [...pointersRef.current.values()];
    if (pointers.length < 2) {
      gestureRef.current = pointers[0]
        ? { midpoint: pointers[0], distance: 0 }
        : null;
      return;
    }

    const [first, second] = pointers;
    const midpoint = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    const previous = gestureRef.current;

    if (previous) {
      panBy(midpoint.x - previous.midpoint.x, midpoint.y - previous.midpoint.y);
      if (previous.distance > 0) {
        setLabelPt((current) =>
          clamp(
            current * (distance / previous.distance),
            MIN_LABEL_PT,
            MAX_LABEL_PT,
          ),
        );
      }
    }

    gestureRef.current = { midpoint, distance };
  }, [panBy]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setIsDragging(true);
    updateGesture();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointersRef.current.get(event.pointerId);
    if (!previous) return;

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      panBy(event.clientX - previous.x, event.clientY - previous.y);
      gestureRef.current = {
        midpoint: { x: event.clientX, y: event.clientY },
        distance: 0,
      };
    } else {
      updateGesture();
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    setIsDragging(pointersRef.current.size > 0);
    updateGesture();
  };

  const resetViewport = () => {
    setCenter(INITIAL_CENTER);
    changeZoom(INITIAL_LABEL_PT);
  };

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-[#f7f7f7] touch-none select-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid slice"
        className="block h-full w-full"
        role="img"
        aria-label="대조시장 안내 지도"
      >
        <image
          href="/images/daejomarket-map.svg"
          x="0"
          y="0"
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          preserveAspectRatio="none"
          pointerEvents="none"
        />
      </svg>

      <div
        className="absolute right-5 top-5 z-20 flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-lg backdrop-blur"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="h-14 w-14 text-3xl font-semibold text-gray-800 hover:bg-gray-100 active:bg-gray-200"
          aria-label="지도 확대"
          onClick={() => changeZoom(labelPt * 1.2)}
        >
          +
        </button>
        <div className="h-px bg-black/10" />
        <button
          type="button"
          className="h-14 w-14 text-3xl font-semibold text-gray-800 hover:bg-gray-100 active:bg-gray-200"
          aria-label="지도 축소"
          onClick={() => changeZoom(labelPt / 1.2)}
        >
          −
        </button>
        <div className="h-px bg-black/10" />
        <button
          type="button"
          className="h-12 w-14 text-sm font-bold text-gray-700 hover:bg-gray-100 active:bg-gray-200"
          aria-label="지도 위치 초기화"
          onClick={resetViewport}
        >
          초기화
        </button>
      </div>

      <output className="pointer-events-none absolute bottom-5 left-5 z-10 rounded-full bg-gray-900/80 px-4 py-2 text-sm font-semibold text-white">
        {Math.round(labelPt)}pt
      </output>
    </div>
  );
}
