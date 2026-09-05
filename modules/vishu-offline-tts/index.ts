import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type VoiceId =
  | 'mf_asha'
  | 'mf_mukta'
  | 'af_heart'
  | 'af_nova'
  | 'mm_vivek';

type NativeTtsModule = {
  getStatus: () => Promise<{
    available: boolean;
    model: string;
    sampleRate: number;
  }>;

  speak: (
    text: string,
    voiceId: VoiceId,
    speed: number,
  ) => Promise<void>;

  stop: () => Promise<void>;
};

let nativeModule: NativeTtsModule | null = null;

if (Platform.OS === 'android') {
  try {
    nativeModule =
      requireNativeModule<NativeTtsModule>('VishuOfflineTts');
  } catch {
    nativeModule = null;
  }
}

export function isNativeTtsAvailable(): boolean {
  return nativeModule !== null;
}

export async function getTtsStatus() {
  if (!nativeModule) {
    return {
      available: false,
      model: 'Android release build required',
      sampleRate: 24000,
    };
  }

  return nativeModule.getStatus();
}

export async function speakMarathi(
  text: string,
  voiceId: VoiceId,
  speed: number,
): Promise<void> {
  if (!nativeModule) {
    throw new Error(
      'VishuOfflineTts is only available in the Android build',
    );
  }

  await nativeModule.speak(text, voiceId, speed);
}

export async function stopMarathi(): Promise<void> {
  await nativeModule?.stop();
}
