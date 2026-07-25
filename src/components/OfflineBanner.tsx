import { useOnlineStatus } from '../utils/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="offline-banner" role="status">
      ⚠ Sin conexión a internet — lo que intentes guardar no se aplicará hasta que se reconecte.
    </div>
  )
}
