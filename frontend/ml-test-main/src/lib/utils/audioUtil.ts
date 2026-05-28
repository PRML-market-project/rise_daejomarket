import Meyda from 'meyda';

export const extractSpectrogram = (
  audioBuffer: Float32Array,
  sampleRate: number
): number[][] => {
  const frameSize = 512;
  const hopSize = 256;
  const melBands = 40;

  const melSpectrogram: number[][] = [];

  for (let i = 0; i < audioBuffer.length - frameSize; i += hopSize) {
    const frame = audioBuffer.slice(i, i + frameSize);
    const features = Meyda.extract('mfcc', frame) as { mfcc: number[] };

    if (features?.mfcc) {
      melSpectrogram.push(features.mfcc);
    }
  }

  return melSpectrogram;
};

export const normalize2D = (data: number[][]): number[][] => {
  const flat = data.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);

  return data.map((row) => row.map((val) => (val - min) / (max - min + 1e-6)));
};
