import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

const APP_ID = import.meta.env.VITE_AGORA_APP_ID || '';

let client: IAgoraRTCClient | null = null;
let localTrack: IMicrophoneAudioTrack | null = null;
let isJoined = false;

export function isAgoraAvailable(): boolean {
  return !!APP_ID;
}

export async function joinVoiceChannel(channelName: string, uid: string): Promise<boolean> {
  if (!APP_ID) {
    console.warn('[Agora] No App ID set. Set VITE_AGORA_APP_ID in .env');
    return false;
  }
  if (isJoined) return true;

  try {
    client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    localTrack = await AgoraRTC.createMicrophoneAudioTrack();
    await client.join(APP_ID, channelName, null, uid);
    await client.publish(localTrack);
    isJoined = true;
    console.log('[Agora] Joined voice channel:', channelName);
    return true;
  } catch (err) {
    console.error('[Agora] Join failed:', err);
    return false;
  }
}

export async function leaveVoiceChannel(): Promise<void> {
  if (!isJoined || !client) return;
  try {
    if (localTrack) {
      localTrack.stop();
      localTrack.close();
      localTrack = null;
    }
    await client.leave();
    client = null;
    isJoined = false;
    console.log('[Agora] Left voice channel');
  } catch (err) {
    console.error('[Agora] Leave failed:', err);
  }
}

export function toggleVoiceMute(): boolean {
  if (!localTrack) return false;
  const muted = localTrack.muted;
  localTrack.setMuted(!muted);
  return !muted;
}

export function isVoiceMuted(): boolean {
  return localTrack ? localTrack.muted : true;
}

export function getVoiceState(): 'available' | 'no_app_id' | 'not_joined' {
  if (!APP_ID) return 'no_app_id';
  if (!isJoined) return 'not_joined';
  return 'available';
}
