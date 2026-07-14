#!/bin/bash
set -e

# Start dbus system bus (needed by avahi)
mkdir -p /var/run/dbus
dbus-daemon --system --fork

# Start avahi for mDNS scanner discovery
avahi-daemon -D --no-chroot

# Configure static scanners via SCANNER_IPS env var (space-separated, for WSL2 where mDNS doesn't cross NAT)
if [ -n "$SCANNER_IPS" ]; then
  echo "[devices]" > /etc/sane.d/airscan.conf
  idx=1
  for scanner_ip in $SCANNER_IPS; do
    echo "\"Network Scanner $idx\" = https://$scanner_ip/eSCL" >> /etc/sane.d/airscan.conf
    idx=$((idx + 1))
  done
  echo "" >> /etc/sane.d/airscan.conf
  echo "discovery = enable" >> /etc/sane.d/airscan.conf
# Fall back to single SCANNER_IP for backwards compatibility
elif [ -n "$SCANNER_IP" ]; then
  echo "[devices]" > /etc/sane.d/airscan.conf
  echo "\"Network Scanner\" = https://$SCANNER_IP/eSCL" >> /etc/sane.d/airscan.conf
  echo "" >> /etc/sane.d/airscan.conf
  echo "discovery = enable" >> /etc/sane.d/airscan.conf
fi

# Launch the application
exec python main.py
