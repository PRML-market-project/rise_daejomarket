import { useCallback, useEffect, useRef, useState } from "react";
import { RECOGNITION_SEARCH_SECONDS, startRecognitionCountdown } from "./recognitionCountdown";

export function useRecognitionCountdown(active: boolean, recognitionKey: string, onComplete: () => void) {
  const [display, setDisplay] = useState({ key: "", seconds: RECOGNITION_SEARCH_SECONDS });
  const completeRef = useRef(onComplete);
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  const cancel = useCallback(() => { cancelRef.current?.(); cancelRef.current = null; }, []);
  useEffect(() => {
    cancel();
    if (!active) return;
    cancelRef.current = startRecognitionCountdown(
      seconds => setDisplay({ key: recognitionKey, seconds }),
      () => completeRef.current(),
    );
    return cancel;
  }, [active, recognitionKey, cancel]);
  return { secondsLeft: display.key === recognitionKey ? display.seconds : RECOGNITION_SEARCH_SECONDS, cancel };
}
