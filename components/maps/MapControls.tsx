import type { CSSProperties } from 'react'
import { AddOutline, MinusOutline, TravelOutline } from 'antd-mobile-icons'

interface MapControlsProps {
  locating?: boolean
  onCurrentLocation?: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  zoomInAriaLabel?: string
  zoomOutAriaLabel?: string
  currentLocationAriaLabel?: string
  buttonStyle?: CSSProperties
}

const defaultButtonStyle: CSSProperties = {
  width: 42,
  height: 42,
  border: 'none',
  borderRadius: 14,
  background: 'var(--app-color-surface)',
  color: 'var(--app-color-title)',
  boxShadow: 'var(--app-shadow-raised)',
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
}

export default function MapControls({
  locating = false,
  onCurrentLocation,
  onZoomIn,
  onZoomOut,
  zoomInAriaLabel = 'Zoom in',
  zoomOutAriaLabel = 'Zoom out',
  currentLocationAriaLabel = 'Move to my current location',
  buttonStyle,
}: MapControlsProps) {
  const mergedButtonStyle = { ...defaultButtonStyle, ...buttonStyle }

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button type='button' aria-label={zoomInAriaLabel} onClick={onZoomIn} style={mergedButtonStyle}>
        <AddOutline fontSize={20} />
      </button>
      <button type='button' aria-label={zoomOutAriaLabel} onClick={onZoomOut} style={mergedButtonStyle}>
        <MinusOutline fontSize={20} />
      </button>
      {onCurrentLocation ? (
        <button
          type='button'
          aria-label={currentLocationAriaLabel}
          onClick={onCurrentLocation}
          style={mergedButtonStyle}
        >
          <TravelOutline fontSize={locating ? 18 : 20} />
        </button>
      ) : null}
    </div>
  )
}
