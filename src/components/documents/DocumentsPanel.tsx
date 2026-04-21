'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createDocumentFolder, createDocumentRecord, deleteDocumentFolder, deleteDocumentRecord, ensureUserDocumentKey, getChildParentIds, getUserDocumentKeys, hideDocumentForUser } from '@/lib/documents-db'
import { decryptDocumentToFile, encryptFileForUsers, ensureLocalDocumentKeyPair } from '@/lib/document-crypto'
import type { DocumentFile, DocumentFolder, DocumentShareScope } from '@/types'

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function documentThumbLabel(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'IMG'
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC'
  return 'FILE'
}

function normalize(value: string) {
  return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function collectDescendantFolderIds(folders: DocumentFolder[], folderId: string): string[] {
  const directChildren = folders.filter(folder => folder.parentFolderId === folderId)
  return directChildren.flatMap(folder => [folder.id, ...collectDescendantFolderIds(folders, folder.id)])
}

function buildFolderOptions(folders: DocumentFolder[], parentFolderId?: string, depth = 0): Array<{ id: string; label: string }> {
  const items = folders.filter(folder => (folder.parentFolderId || '') === (parentFolderId || ''))
  return items.flatMap(folder => [
    { id: folder.id, label: `${'— '.repeat(depth)}${folder.name}` },
    ...buildFolderOptions(folders, folder.id, depth + 1),
  ])
}

const compactButtonBase: React.CSSProperties = {
  height: 34,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 800,
  padding: '0 10px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
}

const dangerButtonStyle: React.CSSProperties = {
  ...compactButtonBase,
  border: '1px solid rgba(239,68,68,0.28)',
  background: 'rgba(239,68,68,0.08)',
  color: '#dc2626',
}

const iconButtonStyle: React.CSSProperties = {
  ...compactButtonBase,
  width: 34,
  padding: 0,
}

function DocumentRow({ document, folderName, busy, userId, deleteMenuId, setDeleteMenuId, onOpen, onHideForMe, onDeleteForEveryone }: {
  document: DocumentFile
  folderName: string
  busy: string | null
  userId?: string
  deleteMenuId: string | null
  setDeleteMenuId: (id: string | null) => void
  onOpen: (id: string) => void
  onHideForMe: (id: string) => void
  onDeleteForEveryone: (id: string) => void
}) {
  const canOpen = !!document.encryptedFileKeys?.[userId || '']
  const unavailableForOthers = Array.isArray(document.pendingRecipientIds) ? document.pendingRecipientIds.length : 0
  const thumb = documentThumbLabel(document.mimeType || '')

  return (
    <div style={{ padding: '10px 14px 10px 18px', borderTop: '1px solid var(--border)', overflow: 'visible', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ width: 44, height: 56, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', flexShrink: 0 }}>
          {thumb}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 14, lineHeight: 1.2, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {document.title || 'Documento cifrado'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            {formatBytes(document.sizeBytes)} · subido por {document.createdByName || 'progenitor'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.35 }}>
            {folderName} · {document.shareScope === 'only_me' ? 'Solo para mí' : 'Para todos'}
          </div>
          {unavailableForOthers > 0 ? <div style={{ fontSize: 11, color: '#9a3412', lineHeight: 1.35 }}>Pendiente de compartirse con {unavailableForOthers} progenitor(es).</div> : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, position: 'relative' }}>
          <button style={{ ...compactButtonBase, minWidth: 72, opacity: busy === document.id || !canOpen ? 0.65 : 1 }} onClick={() => onOpen(document.id)} disabled={busy === document.id || !canOpen}>
            {busy === document.id ? '...' : 'Abrir'}
          </button>
          <button style={{ ...iconButtonStyle, ...dangerButtonStyle }} onClick={() => setDeleteMenuId(deleteMenuId === document.id ? null : document.id)} disabled={busy === document.id} title="Borrar" aria-label="Borrar">
            🗑
          </button>
          {deleteMenuId === document.id ? (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: 8, display: 'grid', gap: 6, minWidth: 186, zIndex: 60 }}>
              <button style={compactButtonBase} onClick={() => onHideForMe(document.id)} disabled={busy === document.id}>Ocultar solo para mí</button>
              <button style={dangerButtonStyle} onClick={() => onDeleteForEveryone(document.id)} disabled={busy === document.id}>Eliminar para todos</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function DocumentsPanel() {
  const { user } = useAuth()
  const { children, selectedChildId, documents, documentFolders } = useAppStore()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'info' | 'success' | 'error'>('info')
  const [uploadStage, setUploadStage] = useState('')
  const [shareScope, setShareScope] = useState<DocumentShareScope>('all_parents')
  const [selectedFolderId, setSelectedFolderId] = useState('root')
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParentId, setNewFolderParentId] = useState('root')
  const [documentTitle, setDocumentTitle] = useState('')
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null)
  const [documentQuery, setDocumentQuery] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ root: true })

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const normalizedQuery = normalize(documentQuery)
  const folderOptions = useMemo(() => buildFolderOptions(documentFolders), [documentFolders])
  const visibleDocuments = useMemo(() => documents.filter(doc => {
    if (!normalizedQuery) return true
    const folderName = doc.folderId ? documentFolders.find(folder => folder.id === doc.folderId)?.name || '' : 'sin carpeta'
    return [doc.title || '', folderName, doc.mimeType || ''].some(field => normalize(field).includes(normalizedQuery))
  }), [documents, documentFolders, normalizedQuery])

  function showMessage(text: string, tone: 'info' | 'success' | 'error' = 'info') {
    setMessage(text)
    setMessageTone(tone)
  }

  function toggleFolder(folderId: string) {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }))
  }

  function getFolderPath(folderId?: string) {
    if (!folderId) return 'Sin carpeta'
    const parts: string[] = []
    let current = documentFolders.find(folder => folder.id === folderId)
    while (current) {
      parts.unshift(current.name)
      current = current.parentFolderId ? documentFolders.find(folder => folder.id === current?.parentFolderId) : undefined
    }
    return parts.join(' / ')
  }

  useEffect(() => {
    if (!user?.uid) return
    ensureLocalDocumentKeyPair(user.uid)
      .then(keys => ensureUserDocumentKey(user.uid, keys.publicKey))
      .catch((error: unknown) => showMessage(error instanceof Error ? error.message : 'No se pudo inicializar el cifrado local', 'error'))
  }, [user?.uid])

  const handleCreateFolder = async (name = newFolderName, parentId = newFolderParentId) => {
    const trimmedName = name.trim()
    if (!user || !child || !trimmedName) return
    setBusy('folder')
    try {
      const actualParentId = parentId === 'root' ? undefined : parentId
      await createDocumentFolder({
        childId: child.id,
        name: trimmedName,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Progenitor',
        shareScope,
        hiddenForUserIds: [],
        ...(actualParentId ? { parentFolderId: actualParentId } : {}),
      })
      setNewFolderName('')
      setNewFolderParentId('root')
      if (actualParentId) setExpandedFolders(prev => ({ ...prev, [actualParentId]: true }))
      showMessage('Carpeta creada.', 'success')
    } catch (error: unknown) {
      console.error('Document folder creation failed', error)
      showMessage(error instanceof Error ? error.message : 'No se pudo crear la carpeta', 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleCreateChildFolder = async (parentFolderId: string) => {
    const name = window.prompt('Nombre de la subcarpeta')?.trim()
    if (!name) return
    await handleCreateFolder(name, parentFolderId)
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user || !child) return
    setBusy('upload')
    setUploadStage('Preparando cifrado...')
    showMessage(`Archivo seleccionado: ${file.name}`, 'info')
    try {
      const localKeys = await ensureLocalDocumentKeyPair(user.uid)
      await ensureUserDocumentKey(user.uid, localKeys.publicKey)
      const parentIds = shareScope === 'all_parents' ? await getChildParentIds(child.id) : [user.uid]
      const keyRegistry = await getUserDocumentKeys(parentIds)
      if (!Object.keys(keyRegistry).includes(user.uid)) throw new Error('No se ha podido preparar tu clave local para cifrar este documento')
      setUploadStage('Cifrando archivo en este dispositivo...')
      const encrypted = await encryptFileForUsers(file, keyRegistry, parentIds)
      const idToken = await user.getIdToken()
      const formData = new FormData()
      formData.append('file', encrypted.encryptedBlob, `${child.id}-${Date.now()}.bin`)
      formData.append('childId', child.id)
      setUploadStage('Subiendo blob cifrado...')
      const uploadResponse = await fetch('/api/documents/upload', { method: 'POST', headers: { Authorization: `Bearer ${idToken}` }, body: formData })
      const uploadPayload = await uploadResponse.json()
      if (!uploadResponse.ok) throw new Error(uploadPayload.error || 'No se pudo subir el documento cifrado')

      const record = {
        childId: child.id,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Progenitor',
        title: documentTitle.trim() || file.name,
        filenameEncrypted: encrypted.metadata.filenameEncrypted,
        filenameIv: encrypted.metadata.filenameIv,
        mimeType: encrypted.metadata.mimeType,
        sizeBytes: encrypted.metadata.sizeBytes,
        blobUrl: uploadPayload.url,
        blobPath: uploadPayload.pathname,
        contentHash: encrypted.metadata.contentHash,
        iv: encrypted.metadata.iv,
        encryptedFileKeys: encrypted.metadata.encryptedFileKeys,
        pendingRecipientIds: encrypted.metadata.pendingRecipientIds,
        shareScope,
        hiddenForUserIds: [],
        ...(selectedFolderId !== 'root' ? { folderId: selectedFolderId } : {}),
      }
      await createDocumentRecord(record)
      setDocumentTitle('')
      if (selectedFolderId !== 'root') setExpandedFolders(prev => ({ ...prev, [selectedFolderId]: true }))
      showMessage(encrypted.metadata.pendingRecipientIds.length > 0 ? `Documento subido. Pendiente de compartirse con ${encrypted.metadata.pendingRecipientIds.length} progenitor(es).` : `Documento subido: ${record.title}`, 'success')
    } catch (error: unknown) {
      console.error('Documents upload failed', error)
      showMessage(error instanceof Error ? error.message : 'Error subiendo documento', 'error')
    } finally {
      setBusy(null)
      setUploadStage('')
    }
  }

  const handleDownload = async (documentId: string) => {
    if (!user?.uid) return
    const document = documents.find(item => item.id === documentId)
    if (!document) return
    setBusy(documentId)
    showMessage('Descargando y descifrando documento...', 'info')
    try {
      const idToken = await user.getIdToken()
      const decrypted = await decryptDocumentToFile(document, user.uid, idToken)
      const url = URL.createObjectURL(decrypted.blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = decrypted.filename
      anchor.click()
      URL.revokeObjectURL(url)
      showMessage(`Documento listo: ${decrypted.filename}`, 'success')
    } catch (error: unknown) {
      showMessage(error instanceof Error ? error.message : 'No se pudo abrir el documento', 'error')
    } finally {
      setBusy(null)
    }
  }

  const deleteBlobByPath = async (pathname: string) => {
    if (!user) return
    const idToken = await user.getIdToken()
    const response = await fetch('/api/documents/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ pathname }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'No se pudo borrar el blob cifrado')
  }

  const handleDeleteForEveryone = async (documentId: string) => {
    if (!user) return
    const document = documents.find(item => item.id === documentId)
    if (!document) return
    if (!window.confirm('¿Seguro que quieres borrar este documento para todos?')) return
    setDeleteMenuId(null)
    setBusy(documentId)
    try {
      await deleteBlobByPath(document.blobPath)
      await deleteDocumentRecord(documentId)
      showMessage('Documento eliminado para todos.', 'success')
    } catch (error: unknown) {
      showMessage(error instanceof Error ? error.message : 'No se pudo eliminar el documento', 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleDeleteFolderTree = async (folderId: string) => {
    if (!user) return
    const descendantFolderIds = collectDescendantFolderIds(documentFolders, folderId)
    const allFolderIds = [folderId, ...descendantFolderIds]
    const affectedDocuments = documents.filter(document => document.folderId && allFolderIds.includes(document.folderId))
    const rootFolder = documentFolders.find(folder => folder.id === folderId)
    const confirmText = `Se eliminarán ${allFolderIds.length} carpeta(s) y ${affectedDocuments.length} documento(s) dentro de "${rootFolder?.name || 'carpeta'}". Esta acción afecta también a subcarpetas. ¿Continuar?`
    if (!window.confirm(confirmText)) return
    setBusy(`folder-delete-${folderId}`)
    try {
      for (const document of affectedDocuments) {
        await deleteBlobByPath(document.blobPath)
        await deleteDocumentRecord(document.id)
      }
      for (const id of [...descendantFolderIds.reverse(), folderId]) {
        await deleteDocumentFolder(id)
      }
      showMessage('Carpeta y contenido eliminados.', 'success')
    } catch (error: unknown) {
      showMessage(error instanceof Error ? error.message : 'No se pudo eliminar la carpeta', 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleHideForMe = async (documentId: string) => {
    if (!user?.uid) return
    if (!window.confirm('¿Seguro que quieres ocultar este documento solo para ti?')) return
    setDeleteMenuId(null)
    setBusy(documentId)
    try {
      await hideDocumentForUser(documentId, user.uid)
      showMessage('Documento ocultado solo para ti.', 'success')
    } catch (error: unknown) {
      showMessage(error instanceof Error ? error.message : 'No se pudo ocultar el documento', 'error')
    } finally {
      setBusy(null)
    }
  }

  const renderFolderBranch = (parentFolderId?: string, depth = 0): JSX.Element | null => {
    const foldersHere = documentFolders
      .filter(folder => (folder.parentFolderId || '') === (parentFolderId || ''))
      .filter(folder => !normalizedQuery || normalize(folder.name).includes(normalizedQuery) || visibleDocuments.some(doc => doc.folderId === folder.id))

    const documentsHere = visibleDocuments.filter(doc => (doc.folderId || '') === (parentFolderId || ''))

    if (foldersHere.length === 0 && documentsHere.length === 0 && parentFolderId) return null

    return (
      <>
        {parentFolderId === undefined ? (
          <div style={{ borderBottom: (documentsHere.length > 0 || foldersHere.length > 0) ? '1px solid var(--border)' : 'none' }}>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <button onClick={() => toggleFolder('root')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', display: 'flex', alignItems: 'center', gap: 10, padding: 0, minWidth: 0 }}>
                <span style={{ fontSize: 18 }}>📁</span>
                <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>Sin carpeta</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>({documentsHere.length})</span>
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button style={{ ...compactButtonBase, minWidth: 84 }} onClick={() => { setSelectedFolderId('root'); setExpandedFolders(prev => ({ ...prev, root: true })) }}>Subir aquí</button>
              </div>
            </div>
            {expandedFolders.root !== false ? documentsHere.map(document => <DocumentRow key={document.id} document={document} folderName="Sin carpeta" busy={busy} userId={user?.uid} deleteMenuId={deleteMenuId} setDeleteMenuId={setDeleteMenuId} onOpen={handleDownload} onHideForMe={handleHideForMe} onDeleteForEveryone={handleDeleteForEveryone} />) : null}
          </div>
        ) : null}

        {foldersHere.map(folder => {
          const childFolders = documentFolders.filter(item => item.parentFolderId === folder.id)
          const docsInFolder = visibleDocuments.filter(document => document.folderId === folder.id)
          const isOpen = expandedFolders[folder.id] !== false
          const totalCount = docsInFolder.length + childFolders.length
          return (
            <div key={folder.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: `12px 14px 12px ${14 + depth * 16}px`, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <button onClick={() => toggleFolder(folder.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', display: 'flex', alignItems: 'center', gap: 10, padding: 0, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ fontSize: 18 }}>📁</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>({totalCount})</span>
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button style={{ ...compactButtonBase, minWidth: 84 }} onClick={() => { setSelectedFolderId(folder.id); setExpandedFolders(prev => ({ ...prev, [folder.id]: true })) }}>Subir aquí</button>
                  <button style={iconButtonStyle} onClick={() => handleCreateChildFolder(folder.id)} title="Crear subcarpeta">＋</button>
                  <button style={{ ...iconButtonStyle, ...dangerButtonStyle, opacity: busy === `folder-delete-${folder.id}` ? 0.7 : 1 }} onClick={() => handleDeleteFolderTree(folder.id)} disabled={busy === `folder-delete-${folder.id}`} title="Eliminar carpeta">🗑</button>
                </div>
              </div>
              {isOpen ? (
                <>
                  {docsInFolder.map(document => <DocumentRow key={document.id} document={document} folderName={getFolderPath(folder.id)} busy={busy} userId={user?.uid} deleteMenuId={deleteMenuId} setDeleteMenuId={setDeleteMenuId} onOpen={handleDownload} onHideForMe={handleHideForMe} onDeleteForEveryone={handleDeleteForEveryone} />)}
                  {renderFolderBranch(folder.id, depth + 1)}
                  {docsInFolder.length === 0 && childFolders.length === 0 ? <div style={{ padding: `0 14px 12px ${52 + depth * 16}px`, color: 'var(--text-muted)', fontSize: 12 }}>No hay contenido en esta carpeta.</div> : null}
                </>
              ) : null}
            </div>
          )
        })}
      </>
    )
  }

  if (!child) return <div className="card" style={{ padding: 16 }}>Selecciona un menor para gestionar documentos.</div>
  const toneColor = messageTone === 'error' ? '#b91c1c' : messageTone === 'success' ? '#047857' : 'var(--text-secondary)'

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="page-title">Documentos</div>

      <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 800, color: 'var(--text-strong)' }}>Subidas y carpetas</div>
          <input className="settings-input" value={documentTitle} onChange={e => setDocumentTitle(e.target.value)} placeholder="Nombre del documento" />
          <select className="settings-input" value={shareScope} onChange={e => setShareScope(e.target.value as DocumentShareScope)}><option value="all_parents">Para todos</option><option value="only_me">Solo para mí</option></select>
          <select className="settings-input" value={selectedFolderId} onChange={e => setSelectedFolderId(e.target.value)}><option value="root">Sin carpeta</option>{folderOptions.map(folder => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select>
          <label className="btn-primary" style={{ justifySelf: 'start', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>{busy === 'upload' ? 'Procesando...' : 'Subir PDF o imagen'}<input hidden type="file" accept="application/pdf,image/*" onChange={handleUpload} disabled={!!busy} /></label>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <input className="settings-input" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Nueva carpeta" />
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr auto' }}>
            <select className="settings-input" value={newFolderParentId} onChange={e => setNewFolderParentId(e.target.value)} style={{ marginBottom: 0 }}><option value="root">Crear en raíz</option>{folderOptions.map(folder => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select>
            <button style={{ ...compactButtonBase, minWidth: 110, opacity: busy === 'folder' || !newFolderName.trim() ? 0.6 : 1 }} onClick={() => handleCreateFolder()} disabled={busy === 'folder' || !newFolderName.trim()}>{busy === 'folder' ? 'Creando...' : 'Crear carpeta'}</button>
          </div>
        </div>

        {uploadStage ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{uploadStage}</div> : null}
        {message ? <div style={{ fontSize: 13, color: toneColor }}>{message}</div> : null}
      </div>

      <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 800 }}>Explorar documentos</div>
        <input className="settings-input" value={documentQuery} onChange={e => setDocumentQuery(e.target.value)} placeholder="Buscar por nombre, carpeta o tipo..." />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'visible' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 800 }}>Documentos de {child.name}</div>
        {visibleDocuments.length === 0 && documentFolders.length === 0 ? <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Todavía no hay documentos en esta vista.</div> : <div style={{ display: 'grid', overflow: 'visible' }}>{renderFolderBranch(undefined, 0)}</div>}
      </div>
    </div>
  )
}
