"use client"

import type { DocumentFile, UserDocumentKey } from '@/types'

const PRIVATE_KEY_PREFIX = 'custodia:documents:private:'
const PUBLIC_KEY_PREFIX = 'custodia:documents:public:'

function ensureBrowserCrypto() {
  if (typeof window === 'undefined' || !window.crypto?.subtle) throw new Error('WebCrypto no está disponible en este dispositivo')
  return window.crypto
}

function toBase64(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < array.byteLength; i += 1) binary += String.fromCharCode(array[i])
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomBytes(length: number) {
  const cryptoObj = ensureBrowserCrypto()
  const bytes = new Uint8Array(length)
  cryptoObj.getRandomValues(bytes)
  return bytes
}

async function exportKey(key: CryptoKey, format: 'spki' | 'pkcs8' | 'raw') {
  return toBase64(await ensureBrowserCrypto().subtle.exportKey(format, key))
}

async function importPublicKey(spki: string) {
  return ensureBrowserCrypto().subtle.importKey(
    'spki',
    fromBase64(spki),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  )
}

async function importPrivateKey(pkcs8: string) {
  return ensureBrowserCrypto().subtle.importKey(
    'pkcs8',
    fromBase64(pkcs8),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  )
}

async function getOrCreateKeyPair(uid: string) {
  const privateKeyStorageKey = `${PRIVATE_KEY_PREFIX}${uid}`
  const publicKeyStorageKey = `${PUBLIC_KEY_PREFIX}${uid}`
  const cachedPrivate = localStorage.getItem(privateKeyStorageKey)
  const cachedPublic = localStorage.getItem(publicKeyStorageKey)

  if (cachedPrivate && cachedPublic) {
    return { publicKey: cachedPublic, privateKey: cachedPrivate }
  }

  const keyPair = await ensureBrowserCrypto().subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  )

  const publicKey = await exportKey(keyPair.publicKey, 'spki')
  const privateKey = await exportKey(keyPair.privateKey, 'pkcs8')

  localStorage.setItem(privateKeyStorageKey, privateKey)
  localStorage.setItem(publicKeyStorageKey, publicKey)

  return { publicKey, privateKey }
}

async function sha256Hex(buffer: ArrayBuffer) {
  const hashBuffer = await ensureBrowserCrypto().subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function encryptTextWithKey(value: string, key: CryptoKey) {
  const iv = randomBytes(12)
  const encoded = new TextEncoder().encode(value)
  const encrypted = await ensureBrowserCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return { ciphertext: toBase64(encrypted), iv: toBase64(iv) }
}

async function decryptTextWithKey(ciphertext: string, iv: string, key: CryptoKey) {
  const decrypted = await ensureBrowserCrypto().subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(ciphertext))
  return new TextDecoder().decode(decrypted)
}

export async function ensureLocalDocumentKeyPair(uid: string) {
  return getOrCreateKeyPair(uid)
}

export async function encryptFileForUsers(file: File, recipientKeys: Record<string, UserDocumentKey>) {
  const plaintext = await file.arrayBuffer()
  const contentHash = await sha256Hex(plaintext)
  const fileKey = await ensureBrowserCrypto().subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const rawFileKey = await ensureBrowserCrypto().subtle.exportKey('raw', fileKey)
  const iv = randomBytes(12)
  const encryptedBuffer = await ensureBrowserCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, fileKey, plaintext)
  const encryptedFileKeys: Record<string, string> = {}

  for (const [uid, userKey] of Object.entries(recipientKeys)) {
    const publicKey = await importPublicKey(userKey.publicKey)
    const wrapped = await ensureBrowserCrypto().subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawFileKey)
    encryptedFileKeys[uid] = toBase64(wrapped)
  }

  const encryptedName = await encryptTextWithKey(file.name, fileKey)

  return {
    encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
    metadata: {
      filenameEncrypted: encryptedName.ciphertext,
      filenameIv: encryptedName.iv,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      contentHash,
      iv: toBase64(iv),
      encryptedFileKeys,
    },
  }
}

export async function decryptDocumentToFile(document: DocumentFile, uid: string, idToken: string) {
  const wrappedKey = document.encryptedFileKeys?.[uid]
  if (!wrappedKey) throw new Error('No tienes clave para abrir este documento')

  const { privateKey: privateKeyPkcs8 } = await getOrCreateKeyPair(uid)
  const privateKey = await importPrivateKey(privateKeyPkcs8)
  const rawFileKey = await ensureBrowserCrypto().subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, fromBase64(wrappedKey))
  const fileKey = await ensureBrowserCrypto().subtle.importKey('raw', rawFileKey, { name: 'AES-GCM' }, true, ['decrypt'])

  const response = await fetch(`/api/documents/download?documentId=${encodeURIComponent(document.id)}`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || 'No se pudo descargar el documento cifrado')
  }

  const encryptedBuffer = await response.arrayBuffer()
  const decryptedBuffer = await ensureBrowserCrypto().subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(document.iv) }, fileKey, encryptedBuffer)
  const filename = await decryptTextWithKey(document.filenameEncrypted, document.filenameIv, fileKey)

  return {
    filename,
    blob: new Blob([decryptedBuffer], { type: document.mimeType || 'application/octet-stream' }),
  }
}
