import { useEffect, useRef, useState } from 'react'

export function useInViewport<T extends HTMLElement>(rootMargin = '320px 0px') {
  const ref = useRef<T | null>(null)
  const [isInViewport, setIsInViewport] = useState(false)

  useEffect(() => {
    if (!ref.current) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry?.isIntersecting ?? false)
      },
      {
        rootMargin,
        threshold: 0.01,
      },
    )

    observer.observe(ref.current)

    return () => observer.disconnect()
  }, [rootMargin])

  return {
    ref,
    isInViewport,
  }
}