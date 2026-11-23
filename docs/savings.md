# What you save

<sub>[README](../README.md) · [Install](install.md) · [What you save](savings.md) · [space.pixlfoundation.com](https://space.pixlfoundation.com)</sub>

Measured on the engine's test fixtures on an Apple M2 Pro, release build. Nothing copied
from a datasheet. The same 8.04 MB JPEG, re-encoded every way the engine offers:

| Conversion                                        |        In |      Out |   Change |   Time |
| ------------------------------------------------- | --------: | -------: | -------: | -----: |
| JPEG → **JPEG XL repack** (bit-exact, reversible) |   8.04 MB |  6.55 MB | **−19%** | 0.33 s |
| JPEG → **AVIF** q60                               |   8.04 MB |  2.58 MB | **−68%** | 1.28 s |
| JPEG → WebP q80                                   |   8.04 MB |  3.26 MB |     −59% | 3.44 s |
| JPEG → JPEG XL distance 1 (visually lossless)     |   8.04 MB |  5.53 MB |     −31% | 3.11 s |
| JPEG → HEIC q80                                   |   8.04 MB |  9.66 MB |   _+20%_ |        |
| 16-bit PNG → AVIF 10-bit 4:4:4 q75                | 104.05 MB |  4.92 MB | **−95%** | 2.28 s |
| 16-bit PNG → JPEG XL lossless                     | 104.05 MB | 65.80 MB |     −37% | 9.84 s |
| Canon CR2 → **DNG** (lossless)                    |  35.67 MB | 30.77 MB |     −14% | 0.51 s |
| CR2 → develop → JPEG q92                          |  35.67 MB |  5.40 MB |     −85% | 0.83 s |

Three honest notes, which the app repeats in its own recommendations:

- **The JPEG XL repack is the free lunch.** About 19% off every JPEG in a library, no pixel ever decoded, and the original can be restored byte for byte.
- **AVIF saves the most, HEIC can make files bigger.** Same photo, same "quality 80-ish". The app shows the real size before you commit, so a bad trade is visible, not discovered later.
- **Small PNGs are usually not worth it.** Under about 5 MB the saving rarely pays for a format change, and the app says so.

Try the numbers on your own library size on the [interactive page](https://xuckless.github.io/space-pixl/#savings).
