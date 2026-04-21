'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createDocumentRecord, ensureUserDocumentKey, getChildParentIds, getUserDocumentKeys } from '@/lib/documents-db'
import { ensureLocalDocumentKeyPair, encryptFileForUsers } from '@/lib/document-crypto'
import type { DocumentShareScope } from '@/types'

function normalize(value: string) {
  return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

type Props = {
  childId: string
  value: string[]
  onChange: (ids: string[]) => void
}

export function DocumentAssociations({ childId, value, onChange }: Props) {
  const { user } = useAuth()
  const { documents, documentFolders } = useAppStore()
  const [query, setQuery] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState('root')
  const [documentTitle, setDocumentTitle] = useState('')
  const [shareScope, setShareScope] = useState<DocumentShareScope>('all_parents')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const availableDocuments = useMemo(() => {
    const q = normalize(query)
    return documents.filter(doc => {
      if (doc.childId !== childId) return false
      if (!q) return true
      const folderName = doc.folderId ? documentFolders.find(folder => folder.id === doc.folderId)?.name || '' : 'sin carpeta'
      return [doc.title || '', folderName, doc.mimeType || ''].some(field => normalize(field).includes(q))
    })
  }, [documents, documentFolders, childId, query])

  const toggleDocument = (id: string) => {
    onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id])
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user) return
    setBusy(true)
    setMessage('Subiendo documento...')
    try {
      const localKeys = await ensureLocalDocumentKeyPair(user.uid)
      await ensureUserDocumentKey(user.uid, localKeys.publicKey)
      const parentIds = shareScope === 'all_parents' ? await getChildParentIds(childId) : [user.uid]
      const keyRegistry = await getUserDocumentKeys(parentIds)
      const encrypted = await encryptFileForUsers(file, keyRegistry, parentIds)
      const idToken = await user.getIdToken()
      const formData = new FormData()
      formData.append('file', encrypted.encryptedBlob, `${childId}-${Date.now()}.bin`)
      formData.append('childId', childId)
      const uploadResponse = await fetch('/api/documents/upload', { method: 'POST', headers: { Authorization: `Bearer ${idToken}` }, body: formData })
      const uploadPayload = await uploadResponse.json()
      if (!uploadResponse.ok) throw new Error(uploadPayload.error || 'No se pudo subir el documento')
      const record = {
        childId,
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
      const newId = await createDocumentRecord(record)
      onChange(Array.from(new Set([...value, newId])))
      setDocumentTitle('')
      setMessage('Documento subido y asociado.')
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo subir el documento')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display:'grid', gap:10, marginBottom:14 }}>
      <div className="settings-label">Documentos asociados</div>
      <input className="settings-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar documentos existentes..." />
      <div style={{ maxHeight:180, overflow:'auto', border:'1px solid var(--border)', borderRadius:12, padding:8, display:'grid', gap:6 }}>
        {availableDocuments.length === 0 ? <div style={{ fontSize:12, color:'var(--text-muted)' }}>No hay documentos que coincidan.</div> : availableDocuments.map(doc => {
          const folderName = doc.folderId ? documentFolders.find(folder => folder.id === doc.folderId)?.name : 'Sin carpeta'
          return <label key={doc.id} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:'var(--text-secondary)' }}>
            <input type="checkbox" checked={value.includes(doc.id)} onChange={() => toggleDocument(doc.id)} />
            <span style={{ fontWeight:700, color:'var(--text-strong)' }}>{doc.title || 'Documento'}</span>
            <span>· {folderName}</span>
          </label>
        })}
      </div>
      <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:10, display:'grid', gap:8 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)' }}>Subir y asociar documento nuevo</div>
        <input className="settings-input" value={documentTitle} onChange={e => setDocumentTitle(e.target.value)} placeholder="Nombre del documento" />
        <div style={{ display:'grid', gap:8, gridTemplateColumns:'1fr 1fr' }}>
          <select className="settings-input" value={shareScope} onChange={e => setShareScope(e.target.value as DocumentShareScope)}><option value="all_parents">Para todos</option><option value="only_me">Solo para mí</option></select>
          <select className="settings-input" value={selectedFolderId} onChange={e => setSelectedFolderId(e.target.value)}><option value="root">Sin carpeta</option>{documentFolders.filter(folder => folder.childId === childId).map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
        </div>
        <label className="btn-primary btn-outline" style={{ justifySelf:'start', cursor:busy ? 'wait' : 'pointer', opacity:busy ? 0.7 : 1 }}>
          {busy ? 'Subiendo...' : 'Subir y asociar'}
          <input hidden type="file" accept="application/pdf,image/*" onChange={handleUpload} disabled={busy} />
        </label>
        {message ? <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{message}</div> : null}
      </div>
    </div>
  )
}
