import { useEffect, useState } from 'react'

export function useCountUp(target: number, active: boolean, duration = 600) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return
    if (target === 0) {
      setValue(0)
      return
    }

    let frame: number
    const start = performance.now()

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - progress) ** 3
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, active, duration])

  return value
}
