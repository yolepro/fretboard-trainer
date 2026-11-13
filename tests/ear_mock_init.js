(() => {
  let osc = null, gain = null;
  window.__freq = 30;
  window.__setFreq = (f) => { window.__freq = f; if (osc) osc.frequency.setValueAtTime(f, osc.context.currentTime); };
  const orig = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext();
    osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = window.__freq;
    gain = ctx.createGain(); gain.gain.value = 0.5;
    const dest = ctx.createMediaStreamDestination();
    osc.connect(gain); gain.connect(dest); osc.start();
    try { await ctx.resume(); } catch (e) {}
    return dest.stream;
  };
  const PCS = {C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,
    Do:0,'Do#':1,Reb:1,'Ré':2,'Ré#':3,'Réb':1,Mi:4,Mib:3,Fa:5,'Fa#':6,Sol:7,'Sol#':8,Solb:6,La:9,'La#':10,Lab:8,Si:11,Sib:10};
  window.__parseNote = (s) => {
    s = (s || '').trim().replace('♯', '#').replace('♭', 'b');
    const m = s.match(/^(.+?)(-?\d)$/);
    if (!m || !(m[1] in PCS)) return null;
    return (parseInt(m[2]) + 1) * 12 + PCS[m[1]];
  };
  window.__mf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  window.__play = (midi) => window.__setFreq(window.__mf(midi));
  window.__q = (id) => { const e = document.querySelector(`[data-testid="${id}"]`); return e ? e.innerText : null; };
})();
(() => {
  window.__played = [];
  const NM = {C:0,Cs:1,D:2,Ds:3,E:4,F:5,Fs:6,G:7,Gs:8,A:9,As:10,B:11};
  const op = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const src = this.currentSrc || this.src || '';
    const m = decodeURIComponent(src).match(/\/([A-G]s?)(\d)[^\/]*\.mp3/);
    window.__played.push({ src, midi: m ? (parseInt(m[2]) + 1) * 12 + NM[m[1]] : null, rate: this.playbackRate, t: Date.now() });
    return op.apply(this, arguments);
  };
  window.__lastPlayed = () => { const p = window.__played[window.__played.length - 1]; return p ? p.midi : null; };
})();
