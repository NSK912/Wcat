import { SampleVideo } from '../types';

export const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    id: 'sample-1',
    name: 'Nature Waves (Sample 1)',
    url: '/samples/sample1.mp4',
    duration: 15,
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&auto=format&fit=crop&q=60',
  },
  {
    id: 'sample-2',
    name: 'Bunny Animation (Sample 2)',
    url: '/samples/sample2.mp4',
    duration: 30,
    thumbnail: 'https://images.unsplash.com/photo-1535083783855-76ae62b2914e?w=300&auto=format&fit=crop&q=60',
  },
  {
    id: 'sample-3',
    name: 'Subaru Outback (Sample 3)',
    url: '/samples/sample3.mp4',
    duration: 30,
    thumbnail: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=300&auto=format&fit=crop&q=60',
  },
];

export function formatTime(seconds: number, maxSeconds?: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 10);
  const refSeconds = maxSeconds !== undefined ? maxSeconds : seconds;
  if (refSeconds >= 3600) {
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis}`;
}

export function formatTimeShort(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
