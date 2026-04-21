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
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'info' | 'success' | 'error'>('info')
  const [uploadStage, setUploadStage] = useState('')

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])

  function showMessage(text: string, tone: 'info' | 'success' | 'error' = 'info') {
    setMessage(text)
    setMessageTone(tone)
  }

  useEffect(() => {
    if (!user?.uid) return
    ensureLocalDocumentKeyPair(user.uid)
      .then(keys => ensureUserDocumentKey(user.uid, keys.publicKey))
      .catch((error: unknown) => showMessage(error instanceof Error ? error.message : 'No se pudo inicializar el cifrado local', 'error'))
  }, [user?.uid])

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

      setUploadStage('Comprobando claves de los progenitores...')
      const parentIds = await getChildParentIds(child.id)
      const keyRegistry = await getUserDocumentKeys(parentIds)
      const availableKeys = Object.keys(keyRegistry)
      if (!availableKeys.includes(user.uid)) {
        throw new Error('No se ha podido preparar tu clave local para cifrar este documento')
      }

      setUploadStage('Cifrando archivo en este dispositivo...')
      const encrypted = await encryptFileForUsers(file, keyRegistry, parentIds)
      const idToken = await user.getIdToken()
      const formData = new FormData()
      formData.append('file', encrypted.encryptedBlob, `${child.id}-${Date.now()}.bin`)
      formData.append('childId', child.id)

      setUploadStage('Subiendo blob cifrado...')
      const uploadResponse = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      })

      const uploadPayload = await uploadResponse.json()
      if (!uploadResponse.ok) throw new Error(uploadPayload.error || 'No se pudo subir el documento cifrado')

      setUploadStage('Guardando metadatos...')
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
        pendingRecipientIds: encrypted.metadata.pendingRecipientIds,
      })

      if (encrypted.metadata.pendingRecipientIds.length > 0) {
        showMessage(`Documento subido. Queda pendiente de compartirse con ${encrypted.metadata.pendingRecipientIds.length} progenitor(es) cuando inicialicen Documentos.`, 'success')
      } else {
        showMessage(`Documento cifrado y sincronizado correctamente: ${file.name}`, 'success')
      }
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
      console.error('Documents download failed', error)
      showMessage(error instanceof Error ? error.message : 'No se pudo abrir el documento', 'error')
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
    showMessage('Eliminando documento...', 'info')
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
      showMessage('Documento eliminado.', 'success')
    } catch (error: unknown) {
      console.error('Documents delete failed', error)
      showMessage(error instanceof Error ? error.message : 'No se pudo eliminar el documento', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (!child) {
    return <div className="card" style={{ padding: 16 }}>Selecciona un menor para gestionar documentos.</div>
  }

  const toneColor = messageTone === 'error' ? '#b91c1c' : messageTone === 'success' ? '#047857' : 'var(--text-secondary)'

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="page-title">Documentos</div>

      <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--text-strong)', marginBottom: 4 }}>Archivos cifrados antes de subir</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Los PDFs e imágenes se cifran en este dispositivo antes de enviarse al almacenamiento remoto privado.
          </div>
        </div>

        <label className="btn-primary" style={{ justifySelf: 'start', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy === 'upload' ? 'Procesando...' : 'Subir PDF o imagen'}
          <input hidden type="file" accept="application/pdf,image/*" onChange={handleUpload} disabled={!!busy} />
        </label>

        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Puedes subir documentos aunque el otro progenitor todavía no haya inicializado esta pestaña.
        </div>

        {uploadStage ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{uploadStage}</div> : null}
        {message ? <div style={{ fontSize: 13, color: toneColor }}>{message}</div> : null}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 800 }}>Documentos de {child.name}</div>
        {documents.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Todavia no hay documentos.</div>
        ) : (
          <div style={{ display: 'grid' }}>
            {documents.map(document => {
              const unavailableForOthers = Array.isArray(document.pendingRecipientIds) ? document.pendingRecipientIds.length : 0
              const canOpen = !!document.encryptedFileKeys?.[user?.uid || '']
              return (
                <div key={document.id} style={{ display: 'grid', gap: 10, padding: 16, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>Documento cifrado</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {formatBytes(document.sizeBytes)} · subido por {document.createdByName || 'progenitor'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{document.mimeType || 'application/octet-stream'}</div>
                      {unavailableForOthers > 0 ? <div style={{ fontSize: 11, color: '#9a3412' }}>Pendiente de compartirse con {unavailableForOthers} progenitor(es).</div> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="btn-primary btn-outline" onClick={() => handleDownload(document.id)} disabled={busy === document.id || !canOpen}>
                        {busy === document.id ? 'Abriendo...' : 'Abrir'}
                      </button>
                      <button className="btn-primary btn-outline" onClick={() => handleDelete(document.id)} disabled={busy === document.id}>
                        Borrar
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                    hash {document.contentHash.slice(0, 16)}...
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
