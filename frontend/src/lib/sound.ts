let context: AudioContext | null = null

/** Short two-tone chime for new orders (Web Audio — no asset needed). Silently ignored if audio is blocked. */
export function playChime() {
  try {
    context ??= new AudioContext()
    const now = context.currentTime
    ;[880, 1320].forEach((frequency, i) => {
      const osc = context!.createOscillator()
      const gain = context!.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35)
      osc.connect(gain).connect(context!.destination)
      osc.start(now + i * 0.18)
      osc.stop(now + i * 0.18 + 0.4)
    })
  } catch {
    /* autoplay policy or no audio device */
  }
}
