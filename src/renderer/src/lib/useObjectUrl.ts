import { useEffect, useState } from 'react'
import type { RenderedImage } from '../../../shared/ipc'

/** A blob: URL for a rendered image, revoked when it changes or unmounts. */
export function useObjectUrl(image: RenderedImage | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!image) {
      setUrl(null)
      return
    }
    const blob = new Blob([image.bytes as BlobPart], { type: image.mime })
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [image])
  return url
}
