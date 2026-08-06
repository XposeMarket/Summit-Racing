#!/bin/bash
cd "$(dirname "$0")"
clear
printf "Starting Summit Rush v1.7.3 with Spa in Intel Mac performance mode and LAN multiplayer...\n\n"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js, then run this file again."
  read -r -p "Press Return to close..."
  exit 1
fi
START_PATH='/?quality=performance' node server.js
status=$?
printf "\nSummit Rush multiplayer server stopped.\n"
read -r -p "Press Return to close..."
exit $status
