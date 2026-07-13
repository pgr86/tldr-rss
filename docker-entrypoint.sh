#!/bin/sh
if [ -n "$PORT" ] || [ "$1" = "server" ]; then
  exec node /action/server/index.js
else
  exec node /action/index.js "$@"
fi
