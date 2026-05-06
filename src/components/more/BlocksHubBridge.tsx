'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { RejectedItemsCleanupPanel } from '@/components/requests/RejectedItemsCleanupPanel'

type ScreenBounds = { top: number; bottom: number; left: number; width: number }

function findMoreGrid() {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>('.more-tab-screen-grid, .more-real-grid')
}

function isMoreContextOpen() {
  if (typeof document === 'undefined') return false
  return document.body.classList.contains('custodia-more-screen-open') || document.body.classList.contains('custodia-more-open')
}

function readBounds(): ScreenBounds {
  const header = document.querySelector<HTMLElement>('.app-header')
  const nav = document.querySelector<HTMLElement>('.bottom-nav')
  const shell = document.querySelector<HTMLElement>('.app-shell')
  const shellRect = shell?.getBoundingClientRect()
  const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0)
  const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight
  return {
    top: headerBottom + 4,
    bottom: Math.max(88, window.innerHeight - navTop + 8),
    left: shellRect?.left ?? 0,
    width: shellRect?.width ?? window.innerWidth,
  }
}

export function BlocksHubBridge() {
  const [gridElement, setGridElement] = useState<HTMLElement | null>(null)
  const [blocksOpen, setBlocksOpen] = useState(false)
  const [bounds, setBounds] = useState<ScreenBounds | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const sync = () => {
      setGridElement(findMoreGrid())
      if (!isMoreContextOpen()) setBlocksOpen(false)
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.toggle('custodia-blocks-open', blocksOpen)
    return () => document.body.classList.remove('custodia-blocks-open')
  }, [blocksOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setBounds(readBounds())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const close = () => setBlocksOpen(false)
    window.addEventListener('custodia:navigate', close)
    return () => window.removeEventListener('custodia:navigate', close)
  }, [])

  const openBlocks = () => {
    setBounds(readBounds())
    setBlocksOpen(true)
  }

  const card = gridElement
    ? createPortal(
        <button
          type="button"
          className="more-real-card more-blocks-card"
          style={{ '--more-tone': '#ef4444' } as CSSProperties}
          onClick={openBlocks}
        >
          <span className="more-real-card-copy">
            <span className="more-real-card-title">Bloqueos</span>
            <span className="more-real-card-subtitle">Elementos rechazados y limpieza</span>
          </span>
          <span className="more-real-icon-wrap" aria-hidden="true">🚫</span>
        </button>,
        gridElement
      )
    : null

  const screen = blocksOpen && bounds
    ? createPortal(
        <section
          className="blocks-menu-screen blocks-tab-screen"
          aria-label="Bloqueos y limpieza"
          style={{
            '--blocks-screen-top': `${bounds.top}px`,
            '--blocks-screen-bottom': `${bounds.bottom}px`,
            '--blocks-screen-left': `${bounds.left}px`,
            '--blocks-screen-width': `${bounds.width}px`,
          } as CSSProperties}
        >
          <div className="blocks-tab-screen-inner">
            <div className="blocks-menu-hero">
              <div>
                <div className="blocks-menu-kicker">Más</div>
                <h1 className="blocks-menu-title">Bloqueos</h1>
                <p className="blocks-menu-subtitle">Elementos rechazados, bloqueos de disponibilidad y limpieza.</p>
              </div>
              <button type="button" className="blocks-menu-back" onClick={() => setBlocksOpen(false)}>Volver</button>
            </div>
            <RejectedItemsCleanupPanel embedded />
          </div>
        </section>,
        document.body
      )
    : null

  return <>{card}{screen}</>
}
