#!/bin/bash
set -e

# Start dbus system bus (needed by avahi)
mkdir -p /var/run/dbus
rm -f /run/dbus/pid /var/run/dbus/pid
dbus-daemon --system --fork

# Start avahi for mDNS scanner discovery
avahi-daemon -D --no-chroot

# Configure static scanners via SCANNER_IPS env var (space-separated, for WSL2 where mDNS doesn't cross NAT)
# Optionally set SCANNER_NAMES (space-separated, 1:1 with SCANNER_IPS) for friendly model names
if [ -n "$SCANNER_IPS" ]; then
  echo "discovery = enable" > /etc/sane.d/airscan.conf
  echo "" >> /etc/sane.d/airscan.conf
  echo "[devices]" >> /etc/sane.d/airscan.conf
  ips_arr=($SCANNER_IPS)
  names_arr=(${SCANNER_NAMES:-})
  for idx in "${!ips_arr[@]}"; do
    scanner_ip="${ips_arr[$idx]}"
    scanner_name="${names_arr[$idx]:-Network Scanner $((idx + 1))}"
    echo "\"$scanner_name\" = https://$scanner_ip/eSCL" >> /etc/sane.d/airscan.conf
  done
# Fall back to single SCANNER_IP for backwards compatibility
elif [ -n "$SCANNER_IP" ]; then
  echo "discovery = enable" > /etc/sane.d/airscan.conf
  echo "" >> /etc/sane.d/airscan.conf
  echo "[devices]" >> /etc/sane.d/airscan.conf
  echo "\"${SCANNER_NAME:-Network Scanner}\" = https://$SCANNER_IP/eSCL" >> /etc/sane.d/airscan.conf
fi

# Launch the application
exec python main.py
