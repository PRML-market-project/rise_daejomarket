import { useState, useRef } from 'react';

export const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const recordingTimeoutRef = useRef<number | null>(null);

  const convertTo16kHzWav = async (audioBlob: Blob): Promise<Blob> => {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const offlineContext = new OfflineAudioContext(
        1,
        audioBuffer.duration * 16000,
        16000
      );
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start();

      const renderedBuffer = await offlineContext.startRendering();

      const wavBlob = await new Promise<Blob>((resolve) => {
        const wav = offlineContext.createBuffer(
          1,
          renderedBuffer.length,
          16000
        );
        wav.getChannelData(0).set(renderedBuffer.getChannelData(0));

        const wavBuffer = new ArrayBuffer(44 + renderedBuffer.length * 2);
        const view = new DataView(wavBuffer);

        const writeString = (offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + renderedBuffer.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, 16000, true);
        view.setUint32(28, 16000 * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, renderedBuffer.length * 2, true);

        const channelData = renderedBuffer.getChannelData(0);
        for (let i = 0; i < channelData.length; i++) {
          const sample = Math.max(-1, Math.min(1, channelData[i]));
          view.setInt16(44 + i * 2, sample * 0x7fff, true);
        }

        resolve(new Blob([wavBuffer], { type: 'audio/wav' }));
      });

      return wavBlob;
    } finally {
      await audioContext.close();
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    recordingTimeoutRef.current = window.setTimeout(() => {
      stopRecording();
    }, 7000);
  };

  const stopRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    setIsRecording(false);
  };

  return {
    isRecording,
    startRecording,
    stopRecording,
    convertTo16kHzWav,
  };
};
