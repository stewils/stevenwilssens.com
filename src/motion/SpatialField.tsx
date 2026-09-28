import { useEffect, useRef, useState, type ReactNode } from 'react'

const ringCount = 6

// Concentric "sound field" rings around the profile photo. They spread out once
// on load, lean toward the pointer the way spatial audio places a source
// relative to the listener, and send out a wave when the photo is pressed.
export default function SpatialField({ children }: { children: ReactNode }) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const [waves, setWaves] = useState<number[]>([])

  useEffect(() => {
    const field = fieldRef.current
    const finePointer = window.matchMedia?.('(pointer: fine)').matches
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!field || !finePointer || reducedMotion) return
    let frame = 0
    const follow = (event: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = field.getBoundingClientRect()
        const clamp = (value: number) => Math.max(-1, Math.min(1, value))
        field.style.setProperty('--px', clamp((event.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2)).toFixed(3))
        field.style.setProperty('--py', clamp((event.clientY - (box.top + box.height / 2)) / (window.innerHeight / 2)).toFixed(3))
      })
    }
    window.addEventListener('pointermove', follow, { passive: true })
    return () => {
      window.removeEventListener('pointermove', follow)
      cancelAnimationFrame(frame)
    }
  }, [])

  const emit = () => setWaves((current) => [...current.slice(-3), Date.now()])

  return (
    <div className="spatial-field" ref={fieldRef}>
      <div className="spatial-rings" aria-hidden="true">
        {Array.from({ length: ringCount }, (_, index) => <span key={index} style={{ '--ring': index + 1 } as React.CSSProperties} />)}
        {waves.map((id) => <span key={id} className="spatial-wave" onAnimationEnd={() => setWaves((current) => current.filter((wave) => wave !== id))} />)}
      </div>
      <div className="hero-mark" onPointerDown={emit}>{children}</div>
    </div>
  )
}
