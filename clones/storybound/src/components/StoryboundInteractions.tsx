'use client'

import { useEffect } from 'react'

const SPARK_INTERVAL_MS = 48
const SPARK_LIFETIME_MS = 1400
const BACK_TO_TOP_THRESHOLD = 600
const STORYBOUND_ORIGIN = 'https://storybound.cc'

export function StoryboundInteractions() {
  useEffect(() => {
    const cleanups: Array<() => void> = []
    const sparkElements = new Set<HTMLSpanElement>()
    const sparkTimeouts = new Set<number>()
    const hasFinePointer = window.matchMedia(
      '(hover: hover) and (pointer: fine)',
    ).matches

    let heroRafId: number | null = null
    let scrollRafId: number | null = null

    if (hasFinePointer) {
      document.querySelectorAll<HTMLElement>('.feature').forEach((feature) => {
        const handleFeatureMouseMove = (event: MouseEvent) => {
          const rect = feature.getBoundingClientRect()

          if (rect.width === 0 || rect.height === 0) {
            return
          }

          const x = ((event.clientX - rect.left) / rect.width) * 100
          const y = ((event.clientY - rect.top) / rect.height) * 100

          feature.style.setProperty('--mx', `${x}%`)
          feature.style.setProperty('--my', `${y}%`)
        }

        feature.addEventListener('mousemove', handleFeatureMouseMove)
        cleanups.push(() => {
          feature.removeEventListener('mousemove', handleFeatureMouseMove)
        })
      })

      const hero = document.querySelector<HTMLElement>('.hero')
      const heroOrbs = document.querySelector<HTMLElement>('.hero-orbs')
      const heroScene = document.querySelector<HTMLElement>('.hero-scene')

      if (hero && heroOrbs) {
        let offsetX = 0
        let offsetY = 0

        const renderHeroParallax = () => {
          heroOrbs.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`

          if (heroScene) {
            heroScene.style.transform = `translate3d(${offsetX * 0.35}px, ${offsetY * 0.35}px, 0)`
          }

          heroRafId = null
        }

        const handleHeroMouseMove = (event: MouseEvent) => {
          const rect = hero.getBoundingClientRect()

          if (rect.width === 0 || rect.height === 0) {
            return
          }

          const x = (event.clientX - rect.left) / rect.width - 0.5
          const y = (event.clientY - rect.top) / rect.height - 0.5

          offsetX = x * 16
          offsetY = y * 12

          if (heroRafId === null) {
            heroRafId = window.requestAnimationFrame(renderHeroParallax)
          }
        }

        const handleHeroMouseLeave = () => {
          if (heroRafId !== null) {
            window.cancelAnimationFrame(heroRafId)
            heroRafId = null
          }

          heroOrbs.style.removeProperty('transform')
          heroScene?.style.removeProperty('transform')
        }

        hero.addEventListener('mousemove', handleHeroMouseMove)
        hero.addEventListener('mouseleave', handleHeroMouseLeave)
        cleanups.push(() => {
          hero.removeEventListener('mousemove', handleHeroMouseMove)
          hero.removeEventListener('mouseleave', handleHeroMouseLeave)
          heroOrbs.style.removeProperty('transform')
          heroScene?.style.removeProperty('transform')
        })
      }

      const attachSparks = (container: HTMLElement) => {
        let lastSpawnTime = -SPARK_INTERVAL_MS

        const handleSparkMouseMove = (event: MouseEvent) => {
          const now = window.performance.now()

          if (now - lastSpawnTime < SPARK_INTERVAL_MS) {
            return
          }

          lastSpawnTime = now

          const rect = container.getBoundingClientRect()
          const spark = document.createElement('span')
          const angle = Math.random() * Math.PI * 2
          const distance = 14 + Math.random() * 26
          const scale = 0.6 + Math.random() * 0.9

          spark.className = 'spark'
          spark.setAttribute('aria-hidden', 'true')
          spark.style.left = `${event.clientX - rect.left - 3}px`
          spark.style.top = `${event.clientY - rect.top - 3}px`
          spark.style.width = `${6 * scale}px`
          spark.style.height = `${6 * scale}px`
          spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`)
          spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`)

          container.appendChild(spark)
          sparkElements.add(spark)

          const timeoutId = window.setTimeout(() => {
            spark.remove()
            sparkElements.delete(spark)
            sparkTimeouts.delete(timeoutId)
          }, SPARK_LIFETIME_MS)

          sparkTimeouts.add(timeoutId)
        }

        container.addEventListener('mousemove', handleSparkMouseMove)
        cleanups.push(() => {
          container.removeEventListener('mousemove', handleSparkMouseMove)
        })
      }

      document
        .querySelectorAll<HTMLElement>('.hero, .final-cta')
        .forEach(attachSparks)
    }

    document
      .querySelectorAll<HTMLAnchorElement>('a[href^="/dl/"]')
      .forEach((anchor) => {
        anchor.href = `${STORYBOUND_ORIGIN}${anchor.getAttribute('href')}`
      })

    const downloadTarget = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? `${STORYBOUND_ORIGIN}/dl/mac`
      : `${STORYBOUND_ORIGIN}/dl/win`

    document
      .querySelectorAll<HTMLAnchorElement>('a[data-dl="auto"]')
      .forEach((anchor) => {
        anchor.href = downloadTarget
      })

    const backToTop = document.querySelector<HTMLElement>('.back-to-top')

    if (backToTop) {
      const updateBackToTop = () => {
        backToTop.classList.toggle(
          'visible',
          window.scrollY > BACK_TO_TOP_THRESHOLD,
        )
        scrollRafId = null
      }

      const handleScroll = () => {
        if (scrollRafId === null) {
          scrollRafId = window.requestAnimationFrame(updateBackToTop)
        }
      }

      const handleBackToTopClick = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }

      updateBackToTop()
      window.addEventListener('scroll', handleScroll, { passive: true })
      backToTop.addEventListener('click', handleBackToTopClick)
      cleanups.push(() => {
        window.removeEventListener('scroll', handleScroll)
        backToTop.removeEventListener('click', handleBackToTopClick)
        backToTop.classList.remove('visible')
      })
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup())

      if (heroRafId !== null) {
        window.cancelAnimationFrame(heroRafId)
      }

      if (scrollRafId !== null) {
        window.cancelAnimationFrame(scrollRafId)
      }

      sparkTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
      sparkElements.forEach((spark) => {
        spark.remove()
      })
      sparkTimeouts.clear()
      sparkElements.clear()
    }
  }, [])

  return null
}
