import { useCallback, useEffect, useRef, useState } from "react";
import { KIOSK_TTS_URL } from "./kioskAiSearch";

export function useKioskSpeech(text: string, language: "ko" | "en" | "vi") {
  const contextRef = useRef<AudioContext | null>(null);
  const [isSpeechActive, setIsSpeechActive] = useState(false);

  // Resume during the search button gesture so delayed AI replies can play.
  const prepareSpeech = useCallback(() => {
    try {
      const context = contextRef.current ?? new AudioContext();
      contextRef.current = context;
      void context.resume().catch((error) => console.warn("Kiosk audio could not start", error));
    } catch (error) {
      console.warn("Kiosk audio is unavailable", error);
    }
  }, []);

  useEffect(() => {
    const context = contextRef.current;
    if (!text.trim() || !context) return;
    const controller = new AbortController();
    let source: AudioBufferSourceNode | null = null;
    let finishTimeout: ReturnType<typeof setTimeout> | undefined;
    setIsSpeechActive(true);
    const speak = async () => {
      try {
        const response = await fetch(KIOSK_TTS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`TTS failed: ${response.status}`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (controller.signal.aborted) return;
        await context.resume();
        if (controller.signal.aborted) return;
        // Preserve every speech sample. A fade here can erase a final consonant;
        // the silent tail gives the output device time to deliver those samples.
        const padded = context.createBuffer(buffer.numberOfChannels,
          buffer.length + Math.round(buffer.sampleRate * 0.3), buffer.sampleRate);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          padded.getChannelData(channel).set(buffer.getChannelData(channel));
        }
        source = context.createBufferSource();
        source.buffer = padded;
        source.connect(context.destination);
        source.onended = () => {
          source?.disconnect();
          // onended describes the audio graph; physical output can lag behind it.
          const drainMs = Math.ceil(((context.baseLatency || 0) + (context.outputLatency || 0)) * 1000);
          finishTimeout = setTimeout(() => {
            if (!controller.signal.aborted) setIsSpeechActive(false);
          }, drainMs);
        };
        source.start();
      } catch (error) {
        if (!controller.signal.aborted) {
          setIsSpeechActive(false);
          console.warn("Kiosk speech failed", error);
        }
      }
    };
    void speak();
    return () => {
      controller.abort();
      clearTimeout(finishTimeout);
      if (source) source.onended = null;
      source?.stop();
      source?.disconnect();
      setIsSpeechActive(false);
    };
  }, [text, language]);

  useEffect(() => () => {
    void contextRef.current?.close();
    contextRef.current = null;
  }, []);

  return { prepareSpeech, isSpeechActive };
}
