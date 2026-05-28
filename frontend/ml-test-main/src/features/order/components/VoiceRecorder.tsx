import { useEffect, useRef, useState } from 'react';

interface VoiceRecorderProps {
  isRecording: boolean;
  onRecordingComplete: (audioBlob: Blob) => void;
}

const VoiceRecorder = ({
  isRecording,
  onRecordingComplete,
}: VoiceRecorderProps) => {
  const [isRecordingState, setIsRecordingState] = useState(false);
  const [lastRecording, setLastRecording] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRecording && !isRecordingState) {
      startRecording();
    } else if (!isRecording && isRecordingState) {
      stopRecording();
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Start animation loop for audio level
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(
            analyserRef.current.frequencyBinCount
          );
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate average level
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 128); // Normalize to 0-1 range

          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/wav',
        });
        setLastRecording(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        onRecordingComplete(audioBlob);

        // Clean up audio analysis
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }

        // Clean up the stream
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingState(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingState) {
      mediaRecorderRef.current.stop();
      setIsRecordingState(false);
    }
  };

  const playRecording = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
    }
  };

  // Cleanup audio URL when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [audioUrl]);

  return (
    <div className=' bottom-4 right-4 p-4 bg-white rounded-lg shadow-lg'>
      <div className='flex items-center space-x-2'>
        <div
          className={`w-3 h-3 rounded-full ${
            isRecordingState ? 'bg-[var(--color-red-500)] animate-pulse' : 'bg-[var(--color-gray-500)]'
          }`}
        />
        <span className='text-sm font-medium'>
          {isRecordingState ? 'Recording...' : 'Ready'}
        </span>
      </div>

      {/* Audio Level Visualization */}
      {isRecordingState && (
        <div className='mt-2 flex items-center space-x-2'>
          <div className='flex-1 h-2 bg-[var(--color-gray-200)] rounded-full overflow-hidden'>
            <div
              className='h-full bg-[var(--color-blue-500)] transition-all duration-100'
              style={{
                width: `${audioLevel * 100}%`,
                transform: `scaleX(${1 + audioLevel})`,
                transformOrigin: 'left',
              }}
            />
          </div>
        </div>
      )}

      {/* Testing UI - Only visible when there's a recording */}
      {lastRecording && (
        <div className='mt-2 flex items-center space-x-2'>
          <button
            onClick={playRecording}
            className='px-3 py-1 bg-[var(--color-blue-500)] text-white rounded hover:bg-[var(--color-blue-600)] text-sm'
          >
            Play Recording
          </button>
          <span className='text-xs text-[var(--color-gray-500)]'>
            {Math.round(lastRecording.size / 1024)} KB
          </span>
        </div>
      )}

      {/* Hidden audio element for playback */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} className='hidden' />}
    </div>
  );
};

export default VoiceRecorder;
