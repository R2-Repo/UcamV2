import { useEffect, useRef, useState } from 'react'

interface ElementSize {
  width: number
  height: number
}

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useEffect(() => {
    if (!ref.current) {
      return undefined
    }

    const target = ref.current
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })

    observer.observe(target)

    return () => observer.disconnect()
  }, [])

  return { ref, size }
}