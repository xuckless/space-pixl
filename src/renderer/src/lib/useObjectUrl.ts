import { useEffect, useMemo } from 'react'
import type { RenderedImage } from '../../../shared/ipc'

/** A blob: URL for a rendered image, revoked when it changes or unmounts. */
export function useObjectUrl(image: RenderedImage | null | undefined): string | null {
  const url = useMemo(
    () =>
      image ? URL.createObjectURL(new Blob([image.bytes as BlobPart], { type: image.mime })) : null,
    [image]
  )
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url]
  )
  return url
}
