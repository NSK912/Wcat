import {
  EditSettings,
  MediaType,
  TrackColor,
  TimelineClip,
  TimelineTrackData,
  ClipTransform,
} from '../types';

export const COLOR_ORDER: TrackColor[] = [
  'indigo',
  'violet',
  'emerald',
  'amber',
  'rose',
  'cyan',
  'fuchsia',
];

export const createInitialTimelineTracks = (): TimelineTrackData[] => [
  {
    id: 'track-1',
    name: 'Track 1',
    mediaType: 'any',
    color: 'indigo',
    clips: [],
    muted: false,
    locked: false,
    hidden: false,
  },
  {
    id: 'track-2',
    name: 'Track 2',
    mediaType: 'any',
    color: 'violet',
    clips: [],
    muted: false,
    locked: false,
    hidden: false,
  },
];

export const getFileKey = (file: File): string =>
  `${file.name}_${file.size}_${file.lastModified}`;

export const isImageFileOrName = (fileOrName?: File | string | null): boolean => {
  if (!fileOrName) return false;
  if (typeof fileOrName === 'string') {
    return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(fileOrName);
  }
  return (
    fileOrName.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(fileOrName.name)
  );
};

export const isVideoFileOrName = (fileOrName?: File | string | null): boolean => {
  if (!fileOrName) return false;
  if (typeof fileOrName === 'string') {
    return /\.(mp4|mkv|mov|webm|avi|flv|ts|m4v)$/i.test(fileOrName);
  }
  return (
    fileOrName.type.startsWith('video/') ||
    /\.(mp4|mkv|mov|webm|avi|flv|ts|m4v)$/i.test(fileOrName.name)
  );
};

export const isAudioFileOrName = (fileOrName?: File | string | null): boolean => {
  if (!fileOrName) return false;
  if (typeof fileOrName === 'string') {
    return /\.(mp3|wav|aac|m4a|flac|ogg|opus|wma)$/i.test(fileOrName);
  }
  return (
    fileOrName.type.startsWith('audio/') ||
    /\.(mp3|wav|aac|m4a|flac|ogg|opus|wma)$/i.test(fileOrName.name)
  );
};

export const detectMediaType = (file: File): MediaType => {
  if (isVideoFileOrName(file)) return 'video';
  if (isAudioFileOrName(file)) return 'audio';
  if (isImageFileOrName(file)) return 'image';
  return 'any';
};

export const isVisualClip = (clip: TimelineClip): { isVideo: boolean; isImage: boolean; isVisual: boolean } => {
  const isVideo = clip.mediaType === 'video' || isVideoFileOrName(clip.file);
  const isImage = clip.mediaType === 'image' || isImageFileOrName(clip.file);
  return { isVideo, isImage, isVisual: isVideo || isImage };
};

export const buildCssFilterString = (settings: EditSettings): string => {
  let f = `brightness(${settings.brightness}) contrast(${settings.contrast})`;
  switch (settings.filter) {
    case 'grayscale':
      f += ' grayscale(100%)';
      break;
    case 'sepia':
      f += ' sepia(100%)';
      break;
    case 'negative':
      f += ' invert(100%)';
      break;
    case 'blur':
      f += ' blur(3px)';
      break;
    case 'vignette':
      f += ' contrast(120%) brightness(90%)';
      break;
    default:
      break;
  }
  return f;
};

export const getPreviewCssFilter = (settings: EditSettings): string | undefined => {
  if (settings.brightness === 1.0 && settings.contrast === 1.0 && settings.filter === 'none') {
    return undefined;
  }
  return buildCssFilterString(settings);
};

export const hasVisualSettingsModifications = (settings: EditSettings): boolean => {
  return (
    Boolean(settings.cropAspect && settings.cropAspect !== 'original') ||
    settings.filter !== 'none' ||
    settings.brightness !== 1.0 ||
    settings.contrast !== 1.0 ||
    settings.rotation !== 0 ||
    settings.flipH ||
    settings.flipV ||
    Boolean(settings.watermarkText?.trim()) ||
    settings.muteAudio
  );
};

export const getAspectRatioNumber = (
  aspect: EditSettings['cropAspect'] | undefined,
  fallbackAspect: number = 16 / 9
): number => {
  switch (aspect) {
    case '16:9':
      return 16 / 9;
    case '4:3':
      return 4 / 3;
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5;
    case '9:16':
      return 9 / 16;
    case '21:9':
      return 21 / 9;
    default:
      return fallbackAspect;
  }
};

export const getCoverScaleForAspect = (aspect?: EditSettings['cropAspect']): number => {
  switch (aspect) {
    case '9:16':
      return 3.161; // Exact 256/81 scale for 16:9 -> 9:16 vertical fill
    case '1:1':
      return 1.778;
    case '4:5':
      return 2.222;
    case '21:9':
      return 1.309;
    case '4:3':
      return 1.333;
    default:
      return 1.778;
  }
};

export const getDefaultClipTransform = (trackIndex: number): ClipTransform => ({
  x: 50,
  y: 50,
  scale: trackIndex === 0 ? 1.0 : 0.45,
  rotation: 0,
  opacity: 1,
});

export const TRANSITION_HALF = 0.5;

export function calculateTransitionState(
  activeClip: TimelineClip,
  prevClip: TimelineClip | null,
  nextClip: TimelineClip | null,
  t: number
): { isActive: boolean; opacity: number; clipPath?: string } {
  const clipStart = activeClip.startTime || 0;
  const clipDur =
    activeClip.endTime !== undefined && activeClip.endTime > clipStart
      ? activeClip.endTime - clipStart
      : activeClip.duration || activeClip.fileDuration || (activeClip.mediaType === 'image' ? 5 : 10);
  const clipEnd = clipStart + clipDur;

  const prevClipEnd = prevClip
    ? prevClip.endTime !== undefined && prevClip.endTime > (prevClip.startTime || 0)
      ? prevClip.endTime
      : (prevClip.startTime || 0) + (prevClip.duration || prevClip.fileDuration || 10)
    : 0;

  const hasOutgoing =
    activeClip.transition &&
    activeClip.transition !== 'none' &&
    nextClip &&
    Math.abs(clipEnd - (nextClip.startTime || 0)) < 0.15;
  const hasIncoming =
    prevClip &&
    prevClip.transition &&
    prevClip.transition !== 'none' &&
    Math.abs(prevClipEnd - clipStart) < 0.15;

  const isNormallyActive = t >= clipStart && t <= clipEnd;
  const isInOutgoing =
    hasOutgoing && t >= clipEnd - TRANSITION_HALF && t <= clipEnd + TRANSITION_HALF;
  const isInIncoming =
    hasIncoming && t >= prevClipEnd - TRANSITION_HALF && t <= prevClipEnd + TRANSITION_HALF;
  const isSoloFadeEnd =
    activeClip.transition === 'fade' &&
    !hasOutgoing &&
    t >= clipEnd - TRANSITION_HALF &&
    t <= clipEnd;

  if (!isNormallyActive && !isInOutgoing && !isInIncoming && !isSoloFadeEnd) {
    return { isActive: false, opacity: 1.0 };
  }

  let transitionOpacity = 1.0;
  let transitionClipPath: string | undefined = undefined;

  if (isInOutgoing) {
    const transType = activeClip.transition;
    const p = Math.max(0, Math.min(1, (t - (clipEnd - TRANSITION_HALF)) / (2 * TRANSITION_HALF)));
    if (transType === 'fade') {
      transitionOpacity = p <= 0.5 ? 1.0 - p * 2 : 0.0;
    } else if (transType === 'crossfade' || transType === 'dissolve') {
      transitionOpacity = 1.0 - p;
    } else if (transType === 'wipe') {
      transitionOpacity = 1.0;
    }
  } else if (isInIncoming) {
    const transType = prevClip!.transition;
    const p = Math.max(0, Math.min(1, (t - (prevClipEnd - TRANSITION_HALF)) / (2 * TRANSITION_HALF)));
    if (transType === 'fade') {
      transitionOpacity = p > 0.5 ? (p - 0.5) * 2 : 0.0;
    } else if (transType === 'crossfade' || transType === 'dissolve') {
      transitionOpacity = p;
    } else if (transType === 'wipe') {
      transitionOpacity = 1.0;
      const pct = Math.round(p * 100);
      transitionClipPath = `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0 100%)`;
    }
  } else if (isSoloFadeEnd) {
    const p = Math.max(0, Math.min(1, (t - (clipEnd - TRANSITION_HALF)) / TRANSITION_HALF));
    transitionOpacity = 1.0 - p;
  }

  return { isActive: true, opacity: transitionOpacity, clipPath: transitionClipPath };
}

export interface ResolvedVisualLayer {
  trackId: string;
  trackName: string;
  subLayerName: string;
  trackColor: TrackColor;
  trackIndex: number;
  clipIndex: number;
  clip: TimelineClip;
  mediaType: 'video' | 'image';
  url: string;
  transform: ClipTransform;
  muted: boolean;
  locked: boolean;
  volume: number;
  isActive: boolean;
  transitionOpacity: number;
  transitionClipPath?: string;
}

/**
 * Single shared resolver for visual sub-layers across all visible tracks.
 * Used by both App.tsx (Layer Tool sub-layer list) and VideoPlayer.tsx (Multi-Track Preview Compositor).
 */
export function resolveVisualLayers(
  tracks: TimelineTrackData[] | undefined,
  currentTime: number,
  muteAudio: boolean = false,
  getFileUrl?: (file?: File) => string
): ResolvedVisualLayer[] {
  if (!tracks || tracks.length === 0) return [];

  const list: ResolvedVisualLayer[] = [];

  tracks.forEach((track, trackIdx) => {
    if (track.hidden) return;
    const clips = track.clips || [];

    const visualClips = clips
      .filter((c) => isVisualClip(c).isVisual)
      .slice()
      .sort((a, b) => a.startTime - b.startTime);

    const clipSeqMap = new Map<string, number>();
    visualClips.forEach((c, index) => {
      clipSeqMap.set(c.id, index + 1);
    });

    clips.forEach((clip, i) => {
      const { isVideo, isVisual } = isVisualClip(clip);
      if (!isVisual) return;

      const nextClip = i < clips.length - 1 ? clips[i + 1] : null;
      const prevClip = i > 0 ? clips[i - 1] : null;

      const { isActive, opacity: transitionOpacity, clipPath: transitionClipPath } =
        calculateTransitionState(clip, prevClip, nextClip, currentTime);

      const url = clip.previewUrl || (clip.file && getFileUrl ? getFileUrl(clip.file) : '');
      const defaultTransform = getDefaultClipTransform(trackIdx);
      const seqNum = clipSeqMap.get(clip.id) || i + 1;

      list.push({
        trackId: track.id,
        trackName: track.name,
        subLayerName: `Layer ${trackIdx + 1}-${seqNum}`,
        trackColor: track.color,
        trackIndex: trackIdx,
        clipIndex: i,
        clip,
        mediaType: isVideo ? 'video' : 'image',
        url,
        transform: clip.transform ? { ...defaultTransform, ...clip.transform } : defaultTransform,
        muted: Boolean(track.muted || muteAudio),
        locked: Boolean(track.locked),
        volume: track.volume ?? 1,
        isActive,
        transitionOpacity,
        transitionClipPath,
      });
    });
  });

  return list.sort((a, b) => {
    if (a.trackIndex !== b.trackIndex) {
      return a.trackIndex - b.trackIndex;
    }
    return a.clip.startTime - b.clip.startTime;
  });
}
