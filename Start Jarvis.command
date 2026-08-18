#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Jarvis..."
npm start &
sleep 3
open "http://127.0.0.1:4173"
wait
