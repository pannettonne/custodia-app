self.addEventListener('notificationclick', (event) => {
  event.notification?.close()
  const target = event.notification?.data?.FCM_MSG?.fcmOptions?.link || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate?.(target)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
      return undefined
    })
  )
})
