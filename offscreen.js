function beep() {
  const context = new AudioContext();
  [0, 0.22, 0.44].forEach((offset) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.24, context.currentTime + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + 0.2);
    if (offset === 0.44) oscillator.onended = () => context.close();
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "offscreenPlayAlert") beep();
});
