export const soundPresets = [
  { id: 'none', label: '무음', short: 'None', description: '사운드 없이 영상만 내보냅니다.' },
  { id: 'ambientFlow', label: 'Ambient Flow', short: 'Ambient', description: '부드러운 패드와 잔잔한 펄스가 이어지는 제품 소개용 BGM.' },
  { id: 'softCorporate', label: 'Soft Corporate', short: 'Corporate', description: '밝은 코드와 가벼운 리듬이 있는 차분한 B2B SaaS용 BGM.' },
  { id: 'lofiProduct', label: 'Lo-fi Product', short: 'Lo-fi', description: '따뜻한 코드와 약한 드럼 질감이 있는 편안한 데모용 BGM.' },
  { id: 'minimalKeys', label: 'Minimal Keys', short: 'Keys', description: '짧은 키보드 톤과 넓은 여백으로 기능 설명에 집중시키는 트랙.' },
  { id: 'glassMotion', label: 'Glass Motion', short: 'Glass', description: '맑은 글래스 신스와 공기감 있는 패드가 섞인 UI 쇼케이스용.' },
  { id: 'focusDrive', label: 'Focus Drive', short: 'Drive', description: '단정한 베이스 펄스와 리듬으로 커서·기능 데모에 어울리는 트랙.' },
  { id: 'launchDrive', label: 'Launch Drive', short: 'Launch', description: '런칭 티저와 빠른 컷에 맞는 조금 더 강한 전자 리듬.' },
  { id: 'custom', label: '내 오디오 파일', short: 'Custom', description: '업로드한 MP3/WAV/OGG 등의 음악을 사용합니다.' }
];

const TAU = Math.PI * 2;
const NOTES = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99
};

function envelope(t, attack, release, duration) {
  const a = Math.min(1, t / Math.max(.001, attack));
  const r = Math.min(1, Math.max(0, (duration - t) / Math.max(.001, release)));
  return Math.min(a, r);
}

function hashNoise(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function sine(freq, t, phase = 0) { return Math.sin(TAU * freq * t + phase); }
function triangle(freq, t) { return 2 / Math.PI * Math.asin(Math.sin(TAU * freq * t)); }
function softClip(v) { return Math.tanh(v * 1.25) * .86; }

const progressions = {
  ambientFlow: [[NOTES.C3, NOTES.E3, NOTES.G3], [NOTES.A2, NOTES.C3, NOTES.E3], [NOTES.F2, NOTES.A2, NOTES.C3], [NOTES.G2, NOTES.B3 / 2, NOTES.D3]],
  softCorporate: [[NOTES.C3, NOTES.E3, NOTES.G3], [NOTES.G2, NOTES.B3 / 2, NOTES.D3], [NOTES.A2, NOTES.C3, NOTES.E3], [NOTES.F2, NOTES.A2, NOTES.C3]],
  lofiProduct: [[NOTES.A2, NOTES.C3, NOTES.E3], [NOTES.F2, NOTES.A2, NOTES.C3], [NOTES.C3, NOTES.E3, NOTES.G3], [NOTES.G2, NOTES.B3 / 2, NOTES.D3]],
  glassMotion: [[NOTES.C3, NOTES.G3, NOTES.E4], [NOTES.A2, NOTES.E3, NOTES.C4], [NOTES.F2, NOTES.C3, NOTES.A3], [NOTES.G2, NOTES.D3, NOTES.B3]],
  focusDrive: [[NOTES.C3, NOTES.E3, NOTES.G3], [NOTES.C3, NOTES.F3, NOTES.A3], [NOTES.A2, NOTES.C3, NOTES.E3], [NOTES.G2, NOTES.D3, NOTES.G3]],
  launchDrive: [[NOTES.C3, NOTES.E3, NOTES.G3], [NOTES.A2, NOTES.C3, NOTES.E3], [NOTES.F2, NOTES.A2, NOTES.C3], [NOTES.G2, NOTES.B3 / 2, NOTES.D3]]
};

function bpmFor(id) {
  return ({ ambientFlow: 74, softCorporate: 92, lofiProduct: 82, minimalKeys: 68, glassMotion: 88, focusDrive: 106, launchDrive: 126 })[id] || 84;
}

function chordSample(id, t, beat) {
  const chords = progressions[id] || progressions.ambientFlow;
  const bar = beat * 4;
  const chord = chords[Math.floor(t / bar) % chords.length];
  const local = t % bar;
  let v = 0;
  for (let i = 0; i < chord.length; i += 1) {
    const f = chord[i];
    v += sine(f, t, i * .7) * (i === 0 ? .055 : .038);
    v += sine(f * .5, t, i) * .018;
  }
  const swell = .58 + .42 * Math.sin(Math.PI * clamp01(local / bar));
  return v * swell;
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function kick(t, beat, amount = 1) {
  const phase = (t % beat) / beat;
  if (phase > .28) return 0;
  const env = Math.exp(-phase * 12);
  const freq = 52 + 68 * Math.exp(-phase * 10);
  return sine(freq, t) * .12 * env * amount;
}

function hat(t, division, amount = 1) {
  const phase = (t % division) / division;
  if (phase > .16) return 0;
  return hashNoise(Math.floor(t * 44100) * .017) * .021 * Math.exp(-phase * 22) * amount;
}

function pluck(freq, t, start, length = .42, brightness = 1) {
  const dt = t - start;
  if (dt < 0 || dt > length) return 0;
  const env = Math.exp(-dt * 7.2);
  return (sine(freq, dt) * .7 + sine(freq * 2, dt, .4) * .22 + sine(freq * 3, dt, .8) * .08) * env * .12 * brightness;
}

function synthPreset(id, t, beat, sampleIndex) {
  if (id === 'ambientFlow') {
    const pad = chordSample(id, t, beat) * 1.2;
    const pulsePhase = (t % (beat * 2)) / (beat * 2);
    const pulse = sine(NOTES.C3, t) * .026 * Math.exp(-pulsePhase * 4.5);
    return pad + pulse + sine(NOTES.C5, t * .25) * .004;
  }
  if (id === 'softCorporate') {
    const chord = chordSample(id, t, beat);
    const step = Math.floor(t / beat) % 4;
    const keyFreq = [NOTES.E4, NOTES.G4, NOTES.C5, NOTES.G4][step];
    const key = pluck(keyFreq, t, Math.floor(t / beat) * beat, Math.min(.55, beat * .9), .7);
    return chord + key + kick(t, beat * 2, .42) + hat(t, beat / 2, .35);
  }
  if (id === 'lofiProduct') {
    const chord = chordSample(id, t, beat) * .92;
    const swing = beat / 2;
    const bass = sine(NOTES.A2, t) * .04 * Math.exp(-((t % beat) / beat) * 3.2);
    const dust = hashNoise(sampleIndex * .013) * .0045;
    return chord + bass + kick(t, beat * 2, .34) + hat(t + swing * .12, swing, .18) + dust;
  }
  if (id === 'minimalKeys') {
    const sequence = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.E4, NOTES.A3, NOTES.E4, NOTES.G4, NOTES.D4];
    const stepDuration = beat;
    const idx = Math.floor(t / stepDuration) % sequence.length;
    const start = Math.floor(t / stepDuration) * stepDuration;
    return pluck(sequence[idx], t, start, Math.min(.8, beat * 1.25), .78) + sine(NOTES.C3, t) * .012;
  }
  if (id === 'glassMotion') {
    const chord = chordSample(id, t, beat) * .84;
    const seq = [NOTES.G4, NOTES.C5, NOTES.E5, NOTES.D5];
    const step = beat * 2;
    const idx = Math.floor(t / step) % seq.length;
    const start = Math.floor(t / step) * step;
    const glass = pluck(seq[idx], t, start, Math.min(1.2, step), .82) + pluck(seq[idx] * 2, t, start + .06, .7, .18);
    return chord + glass;
  }
  if (id === 'focusDrive') {
    const chord = chordSample(id, t, beat) * .72;
    const phase = (t % (beat / 2)) / (beat / 2);
    const bass = triangle(NOTES.C2, t) * .052 * Math.exp(-phase * 5.5);
    return chord + bass + kick(t, beat, .6) + hat(t, beat / 2, .38);
  }
  if (id === 'launchDrive') {
    const chord = chordSample(id, t, beat) * .58;
    const phase = (t % (beat / 2)) / (beat / 2);
    const bass = sine(NOTES.C2, t) * .07 * Math.exp(-phase * 6.5);
    const snarePhase = ((t + beat) % (beat * 2)) / (beat * 2);
    const snare = snarePhase < .11 ? hashNoise(sampleIndex * .029) * .05 * Math.exp(-snarePhase * 28) : 0;
    return chord + bass + kick(t, beat, .95) + hat(t, beat / 2, .72) + snare;
  }
  return 0;
}

export function createProceduralBuffer(context, presetId, duration) {
  const sampleRate = context.sampleRate || 44100;
  const length = Math.max(1, Math.ceil(duration * sampleRate));
  const buffer = context.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const bpm = bpmFor(presetId);
  const beat = 60 / bpm;

  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const raw = synthPreset(presetId, t, beat, i);
    const edge = envelope(t, .16, .75, duration);
    const stereo = Math.sin(t * .37) * .055;
    left[i] = softClip(raw * edge * (1 + stereo));
    right[i] = softClip(raw * edge * (1 - stereo));
  }
  return buffer;
}

export function applyFade(gainParam, context, volume, duration, fadeEnabled, startAt = 0) {
  const now = context.currentTime;
  gainParam.cancelScheduledValues(now);
  if (!fadeEnabled) {
    gainParam.setValueAtTime(volume, now);
    return;
  }
  const fade = Math.min(.8, duration / 3);
  const initial = startAt < fade ? volume * (startAt / Math.max(.001, fade)) : volume;
  gainParam.setValueAtTime(Math.max(.0001, initial), now);
  if (startAt < fade) gainParam.linearRampToValueAtTime(volume, now + (fade - startAt));
  const remaining = Math.max(0, duration - startAt);
  if (remaining > fade) gainParam.setValueAtTime(volume, now + remaining - fade);
  gainParam.linearRampToValueAtTime(0.0001, now + remaining);
}

function mixEvent(buffer, startTime, duration, generator) {
  const sampleRate = buffer.sampleRate;
  const start = Math.max(0, Math.floor(startTime * sampleRate));
  const end = Math.min(buffer.length, Math.ceil((startTime + duration) * sampleRate));
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  for (let i = start; i < end; i += 1) {
    const local = (i - start) / sampleRate;
    const p = local / Math.max(.001, duration);
    const value = generator(local, p, i);
    const pan = Math.sin((startTime + local) * .9) * .08;
    left[i] = softClip(left[i] + value * (1 - pan));
    right[i] = softClip(right[i] + value * (1 + pan));
  }
}

export function addSceneAccents(buffer, scenes = []) {
  let cursor = 0;
  scenes.forEach((scene) => {
    const duration = Math.max(.1, Number(scene.duration || 0));
    if (scene.cursorEnabled) {
      const clickAt = cursor + duration * (((Number(scene.clickStart) || .72) + (Number(scene.clickEnd) || .84)) / 2);
      mixEvent(buffer, clickAt, .18, (t, p, i) => {
        const env = Math.exp(-t * 22);
        const body = sine(180, t) * .026 + sine(360, t, .3) * .014;
        const texture = hashNoise(i * .071) * .007;
        return (body + texture) * env * (1 - p * .35);
      });
    }
    if (['punch','chapter','spotlight'].includes(scene.directorImpact)) {
      mixEvent(buffer, cursor + .02, .28, (t, p, i) => {
        const shape = Math.sin(Math.PI * clamp01(p));
        const air = hashNoise(i * .031) * .0065;
        const lift = sine(90 + 300 * p, t, .1) * .008;
        return (air + lift) * shape;
      });
    }
    if (scene.transition === 'page-flow') {
      const start = cursor + Math.max(.05, duration - .42);
      mixEvent(buffer, start, .38, (t, p, i) => {
        const shape = Math.sin(Math.PI * clamp01(p));
        const sweep = sine(110 + 420 * p, t, .2) * .022;
        const air = hashNoise(i * .019) * .011;
        return (sweep + air) * shape;
      });
    }
    cursor += duration;
  });
  return buffer;
}
