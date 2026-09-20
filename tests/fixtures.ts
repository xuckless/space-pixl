import type { SourceInfo } from '../src/shared/engine-types'

export function source(over: Partial<SourceInfo> = {}): SourceInfo {
  return {
    format: 'jpeg',
    input: 'Jpeg',
    width: 6000,
    height: 4000,
    channels: 3,
    depth: 'Eight',
    bits: 8,
    bytes: 8_040_000,
    has_exif: true,
    has_icc: false,
    has_xmp: false,
    has_cicp: false,
    has_iptc: false,
    color: 'sRGB',
    color_source: 'Assumed',
    is_hdr: false,
    peak_nits: null,
    orientation: 1,
    is_raw_mosaic: false,
    jpeg: {
      quality: 85,
      luma_quant_table: [],
      chroma_quant_table: [],
      subsampling: 'Quarter',
      progressive: false,
      optimized_huffman: true,
      restart_interval: 0,
      components: 3
    },
    heif: null,
    png: null,
    webp: null,
    jxl: null,
    tiff: null,
    ...over
  }
}
