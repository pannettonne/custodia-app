'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createDocumentFolder, createDocumentRecord, deleteDocumentRecord, ensureUserDocumentKey, getChildParentIds, getUserDocumentKeys, hideDocumentForUser } from '@/lib/documents-db'
import { decryptDocumentToFile, encryptFileForUsers, ensureLocalDocumentKeyPair } from '@/lib/document-crypto'
import type { DocumentShareScope } from '@/types'

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1 }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function documentThumbLabel(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'IMG'
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC'
  return 'FILE'
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
  const [filterFolderId, setFilterFolderId] = useState('all')
  const [newFolderName, setNewFolderName] = useState('')
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null)

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const visibleDocuments = useMemo(() => documents.filter(doc => filterFolderId === 'all' ? true : (filterFolderId === 'root' ? !doc.folderId : doc.folderId === filterFolderId)), [documents, filterFolderId])

  function showMessage(text: string, tone: 'info' | 'success' | 'error' = 'info') { setMessage(text); setMessageTone(tone) }

  useEffect(() => {
    if (!user?.uid) return
    ensureLocalDocumentKeyPair(user.uid)
      .then(keys => ensureUserDocumentKey(user.uid, keys.publicKey))
      .catch((error: unknown) => showMessage(error instanceof Error ? error.message : 'No se pudo inicializar el cifrado local', 'error'))
  }, [user?.uid])

  const handleCreateFolder = async () => {
    if (!user || !child || !newFolderName.trim()) return
    setBusy('folder')
    try {
      await createDocumentFolder({ childId: child.id, name: newFolderName.trim(), createdBy: user.uid, createdByName: user.displayName || user.email || 'Progenitor', shareScope, hiddenForUserIds: [] })
      setNewFolderName('')
      showMessage('Carpeta creada.', 'success')
    } catch (error: unknown) {
      showMessage(error instanceof Error ? error.message : 'No se pudo crear la carpeta', 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user || !child) return
    setBusy('upload'); setUploadStage('Preparando cifrado...'); showMessage(`Archivo seleccionado: ${file.name}`, 'info')
    try {
      const localKeys = await ensureLocalDocumentKeyPair(user.uid)
      await ensureUserDocumentKey(user.uid, localKeys.publicKey)
      const parentIds = shareScope === 'all_parents' ? await getChildParentIds(child.id) : [user.uid]
      const keyRegistry = await getUserDocumentKeys(parentIds)
      if (!Object.keys(keyRegistry).includes(user.uid)) throw new Error('No se ha podido preparar tu clave local para cifrar este documento')
      setUploadStage('Cifrando archivo en este dispositivo...')
      const encrypted = await encryptFileForUsers(file, keyRegistry, parentIds)
      const idToken = await user.getIdToken()
      const formData = new FormData(); formData.append('file', encrypted.encryptedBlob, `${child.id}-${Date.now()}.bin`); formData.append('childId', child.id)
      setUploadStage('Subiendo blob cifrado...')
      const uploadResponse = await fetch('/api/documents/upload', { method: 'POST', headers: { Authorization: `Bearer ${idToken}` }, body: formData })
      const uploadPayload = await uploadResponse.json()
      if (!uploadResponse.ok) throw new Error(uploadPayload.error || 'No se pudo subir el documento cifrado')

      const record = {
        childId: child.id,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Progenitor',
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
      showMessage(encrypted.metadata.pendingRecipientIds.length > 0 ? `Documento subido. Pendiente de compartirse con ${encrypted.metadata.pendingRecipientIds.length} progenitor(es).` : `Documento subido: ${file.name}`, 'success')
    } catch (error: unknown) {
      console.error('Documents upload failed', error)
      showMessage(error instanceof Error ? error.message : 'Error subiendo documento', 'error')
    } finally { setBusy(null); setUploadStage('') }
  }

  const handleDownload = async (documentId: string) => {
    if (!user?.uid) return
    const document = documents.find(item => item.id === documentId)
    if (!document) return
    setBusy(documentId); showMessage('Descargando y descifrando documento...', 'info')
    try {
      const idToken = await user.getIdToken()
      const decrypted = await decryptDocumentToFile(document, user.uid, idToken)
      const url = URL.createObjectURL(decrypted.blob)
      const anchor = window.document.createElement('a')
      anchor.href = url; anchor.download = decrypted.filename; anchor.click(); URL.revokeObjectURL(url)
      showMessage(`Documento listo: ${decrypted.filename}`, 'success')
    } catch (error: unknown) {
      showMessage(error instanceof Error ? error.message : 'No se pudo abrir el documento', 'error')
    } finally { setBusy(null) }
  }

  const handleDeleteForEveryone = async (documentId: string) => {
    if (!user) return
    const document = documents.find(item => item.id === documentId)
    if (!document) return
    if (!window.confirm('¿Seguro que quieres borrar este documento para todos?')) return
    setDeleteMenuId(null)
    setBusy(documentId)
    try {
      const idToken = await user.getIdToken()
      const response = await fetch('/api/documents/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ pathname: document.blobPath }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo borrar el blob cifrado')
      await deleteDocumentRecord(documentId)
      showMessage('Documento eliminado para todos.', 'success')
    } catch (error: unknown) {
      showMessage(error instanceof Error ? error.message : 'No se pudo eliminar el documento', 'error')
    } finally { setBusy(null) }
  }

  const handleHideForMe = async (documentId: string) => {
    if (!user?.uid) return
    if (!window.confirm('¿Seguro que quieres ocultar este documento solo para ti?')) return
    setDeleteMenuId(null)
    setBusy(documentId)
    try { await hideDocumentForUser(documentId, user.uid); showMessage('Documento ocultado solo para ti.', 'success') }
    catch (error: unknown) { showMessage(error instanceof Error ? error.message : 'No se pudo ocultar el documento', 'error') }
    finally { setBusy(null) }
  }

  if (!child) return <div className="card" style={{ padding: 16 }}>Selecciona un menor para gestionar documentos.</div>
  const toneColor = messageTone === 'error' ? '#b91c1c' : messageTone === 'success' ? '#047857' : 'var(--text-secondary)'

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="page-title">Documentos</div>
      <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display:'grid', gap:8 }}>
          <div style={{ fontWeight: 800, color: 'var(--text-strong)' }}>Subidas y carpetas</div>
          <select className="settings-input" value={shareScope} onChange={e => setShareScope(e.target.value as DocumentShareScope)}><option value="all_parents">Para todos</option><option value="only_me">Solo para mi</option></select>
          <select className="settings-input" value={selectedFolderId} onChange={e => setSelectedFolderId(e.target.value)}><option value="root">Sin carpeta</option>{documentFolders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
          <label className="btn-primary" style={{ justifySelf:'start', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>{busy === 'upload' ? 'Procesando...' : 'Subir PDF o imagen'}<input hidden type="file" accept="application/pdf,image/*" onChange={handleUpload} disabled={!!busy} /></label>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input className="settings-input" style={{ marginBottom:0, flex:'1 1 220px' }} value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Nueva carpeta" />
          <button className="btn-primary btn-outline" onClick={handleCreateFolder} disabled={busy === 'folder' || !newFolderName.trim()}>{busy === 'folder' ? 'Creando...' : 'Crear carpeta'}</button>
        </div>
        {uploadStage ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{uploadStage}</div> : null}
        {message ? <div style={{ fontSize: 13, color: toneColor }}>{message}</div> : null}
      </div>
      <div className="card" style={{ padding: 12, display:'grid', gap:8 }}>
        <div style={{ fontWeight:800 }}>Carpetas</div>
        <select className="settings-input" value={filterFolderId} onChange={e => setFilterFolderId(e.target.value)}><option value="all">Todas</option><option value="root">Sin carpeta</option>{documentFolders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'visible' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 800 }}>Documentos de {child.name}</div>
        {visibleDocuments.length === 0 ? <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Todavia no hay documentos en esta vista.</div> : <div style={{ display: 'grid', overflow: 'visible' }}>{visibleDocuments.map(document => {
          const canOpen = !!document.encryptedFileKeys?.[user?.uid || '']
          const unavailableForOthers = Array.isArray(document.pendingRecipientIds) ? document.pendingRecipientIds.length : 0
          const folderName = document.folderId ? documentFolders.find(folder => folder.id === document.folderId)?.name : 'Sin carpeta'
          const thumb = documentThumbLabel(document.mimeType || '')
          return <div key={document.id} style={{ display: 'grid', gap: 10, padding: 16, borderBottom: '1px solid var(--border)', overflow: 'visible', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', overflow: 'visible' }}>
              <div style={{ display:'flex', gap:12, minWidth:0 }}>
                <div style={{ width:56, height:72, borderRadius:12, border:'1px solid var(--border)', background:'var(--bg-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'var(--text-secondary)', flexShrink:0 }}>{thumb}</div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>Documento cifrado</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatBytes(document.sizeBytes)} · subido por {document.createdByName || 'progenitor'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{folderName} · {document.shareScope === 'only_me' ? 'Solo para mi' : 'Para todos'}</div>
                  {unavailableForOthers > 0 ? <div style={{ fontSize: 11, color: '#9a3412' }}>Pendiente de compartirse con {unavailableForOthers} progenitor(es).</div> : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', position:'relative', overflow: 'visible' }}>
                <button className="btn-primary btn-outline" onClick={() => handleDownload(document.id)} disabled={busy === document.id || !canOpen}>{busy === document.id ? 'Abriendo...' : 'Abrir'}</button>
                <button className="btn-primary btn-outline" onClick={() => setDeleteMenuId(deleteMenuId === document.id ? null : document.id)} disabled={busy === document.id} title="Borrar" aria-label="Borrar">🗑️</button>
                {deleteMenuId === document.id ? <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'var(--card-shadow)', padding:8, display:'grid', gap:6, minWidth:170, zIndex:50 }}>
                  <button className="btn-primary btn-outline" onClick={() => handleHideForMe(document.id)} disabled={busy === document.id}>Solo para mi</button>
                  <button className="btn-primary btn-outline" onClick={() => handleDeleteForEveryone(document.id)} disabled={busy === document.id}>Para todos</button>
                </div> : null}
              </div>
            </div>
          </div>
        })}</div>}
      </div>
    </div>
  )
}
