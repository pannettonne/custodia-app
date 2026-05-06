'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { RejectedItemsCleanupPanel } from '@/components/requests/RejectedItemsCleanupPanel'

function findMoreGrid() {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>('.more-tab-screen-grid, .more-real-grid')
}

function findAppMain() {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>('.app-main')
}

function isMoreContextOpen() {
  if (typeof document === 'undefined') return false
  return document.body.classList.contains('custodia-more-screen-open') || document.body.classList.contains('custodia-more-open')
}

function resetMainScroll(mainElement: HTMLElement | null) {
  if (!mainElement) return
  mainElement.scrollTop = 0
  if (typeof window !== 'undefined') window.requestAnimationFrame(() => { mainElement.scrollTop = 0 })
}

export function BlocksHubBridge() {
  const [gridElement, setGridElement] = useState<HTMLElement | null>(null)
  const [mainElement, setMainElement] = useState<HTMLElement | null>(null)
  const [blocksOpen, setBlocksOpen] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const sync = () => {
      setGridElement(findMoreGrid())
      setMainElement(findAppMain())
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
    if (blocksOpen) resetMainScroll(findAppMain())
    return () => document.body.classList.remove('custodia-blocks-open')
  }, [blocksOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const close = () => setBlocksOpen(false)
    window.addEventListener('custodia:navigate', close)
    return () => window.removeEventListener('custodia:navigate', close)
  }, [])

  const openBlocks = () => {
    const appMain = findAppMain()
    setMainElement(appMain)
    resetMainScroll(appMain)
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

  const screen = blocksOpen && mainElement
    ? createPortal(
        <section className="blocks-menu-screen blocks-main-screen" aria-label="Bloqueos y limpieza">
          <div className="blocks-menu-hero">
            <div>
              <div className="blocks-menu-kicker">Más</div>
              <h1 className="blocks-menu-title">Bloqueos</h1>
              <p className="blocks-menu-subtitle">Elementos rechazados, bloqueos de disponibilidad y limpieza.</p>
            </div>
            <button type="button" className="blocks-menu-back" onClick={() => setBlocksOpen(false)}>Volver</button>
          </div>
          <RejectedItemsCleanupPanel embedded />
        </section>,
        mainElement
      )
    : null

  return <>{card}{screen}</>
}
