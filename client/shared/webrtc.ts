import type { Role } from './types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type PeerHandlers = {
  onConnectionState?: (state: RTCPeerConnectionState) => void;
  onIceConnectionState?: (state: RTCIceConnectionState) => void;
  onTrack?: (info: { track: MediaStreamTrack; streams: readonly MediaStream[] }) => void;
  onDataMessage?: (data: string) => void;
  onDataOpen?: () => void;
  onDataClose?: () => void;
  onLocalIce?: (candidate: RTCIceCandidateInit) => void;
};

export class PhoneScenePeer {
  readonly pc: RTCPeerConnection;
  dataChannel: RTCDataChannel | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private makingOffer = false;

  constructor(
    readonly role: Role,
    private readonly handlers: PeerHandlers = {},
  ) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.handlers.onLocalIce?.(candidate.toJSON());
    };
    this.pc.onconnectionstatechange = () => {
      this.handlers.onConnectionState?.(this.pc.connectionState);
    };
    this.pc.oniceconnectionstatechange = () => {
      this.handlers.onIceConnectionState?.(this.pc.iceConnectionState);
    };
    this.pc.ontrack = (event) => {
      this.handlers.onTrack?.({ track: event.track, streams: event.streams });
    };
    this.pc.ondatachannel = (event) => {
      this.bindDataChannel(event.channel);
    };
  }

  addLocalStream(stream: MediaStream) {
    for (const track of stream.getTracks()) {
      const sender = this.pc.addTrack(track, stream);
      if (track.kind === 'video') {
        void this.preferHighQuality(sender);
      }
    }
  }

  private async preferHighQuality(sender: RTCRtpSender) {
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = 2_500_000;
      params.encodings[0].maxFramerate = 30;
      params.encodings[0].scaleResolutionDownBy = 1;
      await sender.setParameters(params);
    } catch (error) {
      console.warn('setParameters failed', error);
    }
  }

  ensureOutgoingDataChannel() {
    if (this.role !== 'mobile') return;
    if (this.dataChannel) return;
    this.bindDataChannel(this.pc.createDataChannel('sensors', { ordered: true }));
  }

  private bindDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    channel.onopen = () => this.handlers.onDataOpen?.();
    channel.onclose = () => this.handlers.onDataClose?.();
    channel.onmessage = (event) => {
      if (typeof event.data === 'string') this.handlers.onDataMessage?.(event.data);
    };
  }

  sendData(payload: unknown) {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(payload));
    }
  }

  async createAndSendOffer(send: (msg: unknown) => void) {
    if (this.role !== 'mobile' || this.makingOffer) return;
    this.makingOffer = true;
    try {
      this.ensureOutgoingDataChannel();
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await this.pc.setLocalDescription(offer);
      send({ type: 'offer', sdp: this.pc.localDescription });
    } finally {
      this.makingOffer = false;
    }
  }

  async handleOffer(sdp: RTCSessionDescriptionInit, send: (msg: unknown) => void) {
    await this.pc.setRemoteDescription(sdp);
    await this.flushIce();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    send({ type: 'answer', sdp: this.pc.localDescription });
  }

  async handleAnswer(sdp: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(sdp);
    await this.flushIce();
  }

  async handleIce(candidate: RTCIceCandidateInit) {
    if (this.pc.remoteDescription) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn('ICE add failed', error);
      }
    } else {
      this.pendingIce.push(candidate);
    }
  }

  private async flushIce() {
    while (this.pendingIce.length) {
      const candidate = this.pendingIce.shift()!;
      try {
        await this.pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn('ICE flush failed', error);
      }
    }
  }

  close() {
    try {
      this.dataChannel?.close();
    } catch {
      /* ignore */
    }
    this.dataChannel = null;
    this.pc.close();
    this.pendingIce = [];
  }
}

export function wsUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/signal`;
}
