{pkgs}: {
  deps = [
    pkgs.chromium
    pkgs.eudev
    pkgs.libxkbcommon
    pkgs.dbus
    pkgs.expat
    pkgs.atk
    pkgs.cairo
    pkgs.pango
    pkgs.alsa-lib
    pkgs.libdrm
    pkgs.mesa
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.xorg.libxcb
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
  ];
}
