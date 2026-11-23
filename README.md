<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/logo-dark.svg"/>
  <img src="docs/readme/logo-light.svg" alt="Space Pixl" width="400"/>
</picture>

**More space. Same pixels.**

<a href="https://github.com/xuckless/space-pixl/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/xuckless/space-pixl?style=flat-square&color=93a4ff&labelColor=0b0d11&label=release"/></a> <img alt="macOS · Windows" src="https://img.shields.io/badge/macOS%20%C2%B7%20Windows-ebe9f3?style=flat-square&logo=apple&logoColor=ebe9f3&labelColor=0b0d11"/> <a href="#license"><img alt="All rights reserved" src="https://img.shields.io/badge/licence-all%20rights%20reserved-ebe9f3?style=flat-square&labelColor=0b0d11"/></a> <img alt="Built on the PIXL engine" src="https://img.shields.io/badge/built%20on-PIXL%20engine-6fd7a3?style=flat-square&labelColor=0b0d11"/>

[space.pixlfoundation.com](https://space.pixlfoundation.com) · [Tour and savings calculator](https://xuckless.github.io/space-pixl/) · [Install](docs/install.md) · [Releases](https://github.com/xuckless/space-pixl/releases/latest)

**Download:** [macOS · Apple silicon](https://github.com/xuckless/space-pixl/releases/latest/download/space-pixl-mac-arm64.dmg) · [macOS · Intel](https://github.com/xuckless/space-pixl/releases/latest/download/space-pixl-mac-x64.dmg) · [Windows x64](https://github.com/xuckless/space-pixl/releases/latest/download/space-pixl-win-x64-setup.exe)

<br/>

<img src="docs/screenshots/optimise-preview.webp" alt="Space Pixl: a 7.67 MB JPEG previewed as a 6.24 MB JPEG XL repack, split before and after, with ranked recommendations on the left" width="820"/>

</div>

Space Pixl measures every photo in a folder, recommends only the conversions that save space, previews the real result, and writes the smaller file beside the original, never over it.

## The size you see is the real file

Every candidate is actually encoded before you commit, so a bad trade is visible up front. A JPEG XL repack takes about a fifth off any JPEG and can be undone byte for byte; AVIF saves the most; HEIC can make a file bigger, and the app says so.

<img src="docs/readme/savings.svg" alt="One 8.04 MB JPEG: JPEG XL repack 6.55 MB (−19%), AVIF 2.58 MB (−68%), HEIC 9.66 MB (+20%, not recommended); the original is kept" width="720"/>

The full table, measured on an M2 Pro: [What you save](docs/savings.md)

## In the app

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/optimise-analysis.webp" alt="Analysis panel: the file, how it was made, and its pixel statistics"><br><sub><b>Analysis.</b> What the file is, how it was made, what its pixels look like.</sub></td>
    <td width="50%"><img src="docs/screenshots/optimise-dials.webp" alt="Dials panel: format, effort, threads, size and pixels, metadata, colour and rounding"><br><sub><b>Dials.</b> Every encoder setting, resize, depth, metadata and colour.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/optimise-converted.webp" alt="Converted: saved 1.43 MB (18.6%), written beside the original"><br><sub><b>Converted.</b> Saved 1.43 MB (18.6%), written beside the original.</sub></td>
    <td><img src="docs/screenshots/stats.webp" alt="Stats page: lifetime storage reclaimed, files converted, average reduction"><br><sub><b>Stats.</b> Storage reclaimed, per day, by format, biggest wins.</sub></td>
  </tr>
</table>

## Install

Download the installer for your computer above. Builds are not code-signed yet, so macOS needs one Terminal line the first time and Windows SmartScreen asks once: [step-by-step install](docs/install.md). The app updates itself; Linux is not shipped.

## Built on the PIXL engine

Space Pixl is the storage half of the [PIXL engine](https://engine.pixlfoundation.com): it reads, analyses and re-encodes, and leaves grading to [Pixl Playroom](https://github.com/xuckless/pixl-playroom), the photo developer on the same engine. The engine makes no decisions of its own; every recommendation you see is the app's, and every number is the engine's report.

## License

Copyright © 2026 xuckless. All rights reserved. This source is published for reference only ([LICENSE](LICENSE)) and cannot be built without the PIXL engine, a separate, closed component distributed only as compiled binaries. The app ships with its [licence agreement](legal/EULA.md), [privacy policy](legal/PRIVACY.md) and [third-party notices](build/THIRD_PARTY_NOTICES.txt).
