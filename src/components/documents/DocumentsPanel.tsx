'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createDocumentRecord, deleteDocumentRecord, ensureUserDocumentKey, getChildParentIds, getUserDocumentKeys } from '@/lib/documents-db'
import { decryptDocumentToFile, encryptFileForUsers, ensureLocalDocumentKeyPair } from '@/lib/document-crypto'

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

export function DocumentsPanel() {
  const { user } = useAuth()
  const { children, selectedChildId, documents } = useAppStore()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string>('')

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])

  useEffect(() => {
    if (!user?.uid) return
    ensureLocalDocumentKeyPair(user.uid)
      .then(keys => ensureUserDocumentKey(user.uid, keys.publicKey))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo inicializar el cifrado local'))
  }, [user?.uid])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user || !child) return

    setBusy('upload')
    setMessage('')
    try {
      const localKeys = await ensureLocalDocumentKeyPair(user.uid)
      await ensureUserDocumentKey(user.uid, localKeys.publicKey)

      const parentIds = await getChildParentIds(child.id)
      const keyRegistry = await getUserDocumentKeys(parentIds)
      const missing = parentIds.filter(uid => !keyRegistry[uid])
      if (missing.length > 0) {
        throw new Error('Falta inicializar Documentos en alguno de los progenitores. Haz que entren una vez en la pestaña Documentos para generar su clave pública.')
      }

      const encrypted = await encryptFileForUsers(file, keyRegistry)
      const idToken = await user.getIdToken()
      const formData = new FormData()
      formData.append('file', encrypted.encryptedBlob, `${child.id}-${Date.now()}.bin`)
      formData.append('childId', child.id)

      const uploadResponse = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      })

      const uploadPayload = await uploadResponse.json()
      if (!uploadResponse.ok) throw new Error(uploadPayload.error || 'No se pudo subir el documento cifrado')

      await createDocumentRecord({
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
      })

      setMessage('Documento cifrado y sincronizado correctamente.')
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Error subiendo documento')
    } finally {
      setBusy(null)
    }
  }

  const handleDownload = async (documentId: string) => {
    if (!user?.uid) return
    const document = documents.find(item => item.id === documentId)
    if (!document) return

    setBusy(documentId)
    setMessage('')
    try {
      const decrypted = await decryptDocumentToFile(document, user.uid)
      const url = URL.createObjectURL(decrypted.blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = decrypted.filename
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'No se pudo abrir el documento')
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async (documentId: string) => {
    if (!user) return
    const document = documents.find(item => item.id === documentId)
    if (!document) return
    if (!window.confirm('¿Eliminar este documento para ambos progenitores?')) return

    setBusy(documentId)
    setMessage('')
    try {
      const idToken = await user.getIdToken()
      const response = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ pathname: document.blobPath }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo borrar el blob cifrado')
      await deleteDocumentRecord(documentId)
      setMessage('Documento eliminado.')
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'No se pudo eliminar el documento')
    } finally {
      setBusy(null)
    }
  }

  if (!child) {
    return <div className="card" style={{ padding: 16 }}>Selecciona un menor para gestionar documentos.</div>
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="page-title">Documentos</div>

      <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--text-strong)', marginBottom: 4 }}>Archivos cifrados antes de subir</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Los PDFs e imágenes se cifran en este dispositivo antes de enviarse al almacenamiento remoto.
          </div>
        </div>

        <label className="btn-primary" style={{ justifySelf: 'start', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy === 'upload' ? 'Subiendo…' : 'Subir PDF o imagen'}
          <input hidden type="file" accept="application/pdf,image/*" onChange={handleUpload} disabled={!!busy} />
        </label>

        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Consejo: el otro progenitor debe entrar al menos una vez en esta pestaña para generar su clave pública local.
        </div>

        {message ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{message}</div> : null}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 800 }}>Documentos de {child.name}</div>
        {documents.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Todavía no hay documentos.</div>
        ) : (
          <div style={{ display: 'grid' }}>
            {documents.map(document => (
              <div key={document.id} style={{ display: 'grid', gap: 10, padding: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>Documento cifrado</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {formatBytes(document.sizeBytes)} · subido por {document.createdByName || 'progenitor'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button className="btn-primary btn-outline" onClick={() => handleDownload(document.id)} disabled={busy === document.id}>
                      {busy === document.id ? 'Abriendo…' : 'Abrir'}
                    </button>
                    <button className="btn-primary btn-outline" onClick={() => handleDelete(document.id)} disabled={busy === document.id}>
                      Borrar
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  hash {document.contentHash.slice(0, 16)}…
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
