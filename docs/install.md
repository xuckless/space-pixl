# Install Space Pixl

<sub>[README](../README.md) · [Install](install.md) · [What you save](savings.md) · [space.pixlfoundation.com](https://space.pixlfoundation.com)</sub>

Installers are attached to every [GitHub release](https://github.com/xuckless/space-pixl/releases).
The app checks for updates on launch and every four hours.

> [!IMPORTANT]
> Builds are **not yet code-signed**. macOS will say the app is _"damaged and can't be opened"_
> and Windows SmartScreen will warn. Both are the standard notices for an unsigned download; the
> steps below get past them. Signed builds are planned.

<details open>
<summary><b>macOS 13+</b></summary>

1. Download the disk image for your Mac. Not sure which? → About This Mac → Chip.
   - [**Apple Silicon**](https://github.com/xuckless/space-pixl/releases/latest/download/space-pixl-mac-arm64.dmg) (M1 or newer)
   - [**Intel**](https://github.com/xuckless/space-pixl/releases/latest/download/space-pixl-mac-x64.dmg)
2. Open the `.dmg` and drag **Space Pixl** to **Applications**.
3. Clear the quarantine flag once (this is what the "damaged" dialog is about). In Terminal:

   ```sh
   xattr -dr com.apple.quarantine "/Applications/Space Pixl.app"
   ```

4. Open Space Pixl from Applications.

Until builds are signed, macOS cannot install updates in place: download the new `.dmg` from
the releases page and repeat step 3.

</details>

<details open>
<summary><b>Windows 10 / 11, 64-bit</b></summary>

1. Download the [**installer**](https://github.com/xuckless/space-pixl/releases/latest/download/space-pixl-win-x64-setup.exe) (`space-pixl-win-x64-setup.exe`).
2. Run it. It installs per user, with no admin prompt. If SmartScreen appears, click **More info**, then **Run anyway**.
3. Space Pixl opens when the installer finishes and updates itself in the background from then on.

</details>

Linux is not shipped.
