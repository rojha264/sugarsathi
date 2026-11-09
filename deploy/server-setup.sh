#!/bin/sh
# One-time setup of a small Ubuntu server (e.g. AWS EC2 free tier, 1 GB RAM). Safe to run again.
#   ssh -i key.pem ubuntu@SERVER 'sh -s' < deploy/server-setup.sh
set -e

# Swap: 1 GB of RAM is not enough for Postgres + API + Caddy at peak.
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf >/dev/null
sudo sysctl -q -p /etc/sysctl.d/99-swappiness.conf

# Keep system logs small on a small disk.
sudo mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=100M\n' | sudo tee /etc/systemd/journald.conf.d/size.conf >/dev/null
sudo systemctl restart systemd-journald

# Docker from Ubuntu's own repository (works on new Ubuntu releases before Docker's repo supports them).
if ! command -v docker >/dev/null; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2 >/dev/null
fi
sudo systemctl enable --now docker >/dev/null
sudo usermod -aG docker "$USER"

mkdir -p ~/sugarsaathi/deploy/backups
echo "Ready: $(sudo docker --version), $(sudo docker compose version --short) compose, swap $(free -m | awk '/Swap/{print $2}') MB, disk free $(df -h / | awk 'NR==2{print $4}')"
