import { useEffect, useState } from 'react';
import { usePorcupine } from '@picovoice/porcupine-react';
import VoiceRecorder from './VoiceRecorder';

const BASE_PATH = import.meta.env.BASE_URL; // Vite가 build 모드에서 경로 세팅
const API_URL = '/api'; // 프록시를 통해 요청하도록 변경

const PORCUPINE_MODEL_PATH = `${BASE_PATH}pp/porcupine_params_ko.pv`;
const PORCUPINE_KEYWORD_PATH = `${BASE_PATH}pp/mallanga_ko_wasm_v3_0_0.ppn`;
const PORCUPINE_ACCESS_KEY = import.meta.env.VITE_PORCUPINE_ACCESS_KEY;

const porcupineKeyword = {
  publicPath: `${PORCUPINE_KEYWORD_PATH}`,
  label: '말랑아',
};

const porcupineModel = {
  publicPath: `${PORCUPINE_MODEL_PATH}`,
};

const KeywordDetector = () => {
  const { keywordDetection, isListening, error, init, start, isLoaded } =
    usePorcupine();
  const [showDetection, setShowDetection] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Initialize Porcupine and start listening
  useEffect(() => {
    // init이 완료될 때까지 기다림
    init(`${PORCUPINE_ACCESS_KEY}`, porcupineKeyword, porcupineModel);
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    start();
  }, [isLoaded]);

  // Handle keyword detection
  useEffect(() => {
    if (!isListening) {
      console.log('Not initialized yet, skipping keyword detection');
      return;
    }

    console.log(
      'Keyword detection effect - keywordDetection:',
      keywordDetection
    );

    if (keywordDetection !== null) {
      console.log('Keyword detected:', keywordDetection);
      setShowDetection(true);
      setIsRecording(true);

      // Stop recording after 5 seconds
      const recordingTimer = setTimeout(() => {
        console.log('Recording timer completed - stopping recording');
        setIsRecording(false);
      }, 5000);

      // Reset detection state after 1 second
      const detectionTimer = setTimeout(() => {
        console.log('Detection timer completed - resetting detection state');
        setShowDetection(false);
      }, 1000);

      return () => {
        console.log('Cleaning up timers');
        clearTimeout(recordingTimer);
        clearTimeout(detectionTimer);
      };
    }
  }, [keywordDetection, isListening]);

  // isListening 상태 변경을 감지하는 별도의 useEffect 추가
  useEffect(() => {
    console.log('isListening state changed:', isListening);
  }, [isListening]);
  useEffect(() => {
    console.log('isLoaded state changed:', isLoaded);
  }, [isLoaded]);

  const convertTo16kHzWav = async (audioBlob: Blob): Promise<Blob> => {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Create offline context for resampling
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

      // Convert to WAV
      const wavBlob = await new Promise<Blob>((resolve) => {
        const wav = offlineContext.createBuffer(
          1,
          renderedBuffer.length,
          16000
        );
        wav.getChannelData(0).set(renderedBuffer.getChannelData(0));

        const wavBuffer = new ArrayBuffer(44 + renderedBuffer.length * 2);
        const view = new DataView(wavBuffer);

        // WAV header
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

        // Write audio data
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

  const handleRecordingComplete = async (audioBlob: Blob) => {
    try {
      console.log('Converting audio to 16kHz WAV...');
      const wavBlob = await convertTo16kHzWav(audioBlob);

      const formData = new FormData();
      formData.append('voice', wavBlob, 'voice.wav');
      formData.append('kiosk_id', '33');
      formData.append('admin_id', '1');

      console.log('Sending audio to server...');
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Server response:', result);
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  };

  return (
    <>
      <div className='bottom-4 right-4 p-4 bg-white rounded-lg shadow-lg'>
        <div className='flex items-center space-x-2'>
          <div
            className={`w-3 h-3 rounded-full ${
              isListening ? 'bg-[var(--color-green-500)]' : 'bg-[var(--color-red-500)]'
            }`}
          />
          <span className='text-sm font-medium'>
            {isListening ? '듣는 중...' : '듣지 않는 중'}
          </span>
        </div>
        {showDetection && (
          <div className='mt-2 p-2 bg-[var(--color-blue-100)] text-[var(--color-blue-800)] rounded text-sm'>
            키워드 감지됨!
          </div>
        )}
        {error && (
          <div className='mt-2 p-2 bg-[var(--color-red-100)] text-[var(--color-red-800)] rounded text-sm'>
            {error.message}
          </div>
        )}
      </div>
      <VoiceRecorder
        isRecording={isRecording}
        onRecordingComplete={handleRecordingComplete}
      />
    </>
  );
};

export default KeywordDetector;
