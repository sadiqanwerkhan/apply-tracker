'use client'

import { useEffect, useRef, useState } from 'react'

type RevealProps = {
  children: React.ReactNode
  className?: string
  delay?: number
  /** translate distance in px before reveal */
  y?: number
  as?: React.ElementType
}

/**
 * Fades + slides its children into view the first time they enter the viewport.
 * Respects prefers-reduced-motion (renders visible immediately).
 */
export function Reveal({ children, className = '', delay = 0, y = 24, as: Tag = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      style={{
        transform: shown ? 'none' : `translateY(${y}px)`,
        opacity: shown ? 1 : 0,
        transitionDelay: `${delay}ms`,
      }}
      className={`transition-all duration-700 ease-out will-change-transform ${className}`}
    >
      {children}
    </Tag>
  )
}
