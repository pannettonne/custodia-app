# 👨‍👩‍👦 CustodiaApp

PWA para gestionar el **régimen de custodia compartida** de menores entre dos progenitores.

## ✨ Funcionalidades

- 📅 **Calendario visual** con colores por progenitor (semanas alternas, quincenas, 2-2-3...)
- 🔄 **Solicitudes de cambio** de día concreto o rango de fechas con observaciones
- 🔍 **Consulta rápida**: ¿de quién es ese día?
- 👥 **Invitación al otro progenitor** simplemente poniendo su email de Google
- 🔔 **Notificaciones** de solicitudes pendientes en tiempo real
- 📱 **PWA instalable** en móvil (Android/iOS)
- 🌐 **Multi-dispositivo**: sincronización en tiempo real con Firebase
- 🔐 **SSO con Google**: sin contraseñas

## 🚀 Setup en 10 minutos

### 1. Crear proyecto Firebase

1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. Crear nuevo proyecto
3. **Authentication** → Sign-in method → habilitar **Google**
4. **Firestore Database** → Crear base de datos → Modo producción
5. **Project Settings** → Your apps → Añadir Web app → copiar credenciales

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
# Editar .env.local con tus credenciales de Firebase
```

### 3. Reglas de Firestore

En Firebase Console → Firestore → **Reglas**, pegar el contenido de `firestore.rules`

### 4. Desarrollo local

```bash
npm install
npm run dev
# Abre http://localhost:3000
```

### 5. Deploy en Vercel

```bash
# Opción A: desde GitHub (recomendado)
# 1. Subir a GitHub
# 2. vercel.com → New Project → importar repo
# 3. Añadir variables de entorno NEXT_PUBLIC_FIREBASE_*
# 4. Deploy

# Opción B: Vercel CLI
npx vercel --prod
```

**Importante**: Añadir el dominio de Vercel en Firebase Console → Authentication → Authorized domains

## 📱 Cómo usar

1. **Progenitor 1**: Entra con Google → Ajustes → Añadir menor → Configurar patrón → Invitar al otro progenitor (por email)
2. **Progenitor 2**: Entra con Google → Ajustes → Aceptar invitación
3. Ambos ven el mismo calendario en tiempo real
4. Cualquiera puede pedir cambios de día desde el calendario

## 📱 Iconos PWA/iPhone

Para los iconos instalables de Nexo, usar siempre **PNG estático real** servido desde `public/`.

Regla rápida:

- `public/icon.png` → PNG cuadrado con fondo blanco, símbolo centrado y sin texto.
- `public/apple-touch-icon.png` → PNG cuadrado con fondo blanco para iOS.
- `public/favicon.png` y `public/icons/icon-192.png` → mismo estilo.
- `manifest.json` debe apuntar a `/icon.png`.
- `layout.tsx` debe apuntar a `/icon.png` y `/apple-touch-icon.png`.

No usar SVG, rutas dinámicas de Next, PNG transparente, `fetch('/icon.png')` desde route handlers ni el logo horizontal completo como icono PWA.

Ver la guía completa en [`docs/pwa-icons.md`](docs/pwa-icons.md).

## 🗂️ Estructura

```
src/
├── app/                      # Next.js App Router
├── components/
│   ├── calendar/             # Calendario + consulta rápida
│   ├── requests/             # Modal y lista de solicitudes
│   ├── settings/             # Panel de configuración
│   └── ui/                   # Login + AppShell
├── hooks/                    # Subscripciones Firestore RT
├── lib/                      # Firebase, auth, db, utils
├── store/                    # Zustand store
└── types/                    # TypeScript interfaces
firestore.rules               # Reglas de seguridad Firestore
firestore.indexes.json        # Índices compuestos
```

## 🔒 Seguridad

Las reglas de Firestore garantizan que cada usuario solo accede a los datos de sus propios hijos. La compartición es explícita: solo funciona entre los dos progenitores invitados.
