import { DesktopCameraModal } from './DesktopCameraModal'
import { MobileCameraModal } from './MobileCameraModal'
import { useCameraModalController, useIsMobileViewport, type CameraModalProps } from './modalShared'

export function CameraModal(props: CameraModalProps) {
  const isMobile = useIsMobileViewport()
  const controller = useCameraModalController({
    ...props,
    isMobile,
  })

  return isMobile ? (
    <MobileCameraModal
      controller={controller}
      onClose={props.onClose}
      onCopyLink={props.onCopyLink}
      onOpenMap={props.onOpenMap}
    />
  ) : (
    <DesktopCameraModal
      controller={controller}
      onClose={props.onClose}
    />
  )
}