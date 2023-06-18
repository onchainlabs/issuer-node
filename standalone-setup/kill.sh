#!/bin/bash
PID=$(sudo lsof -i :8200 | awk '$2 ~ /^[0-9]+$/ { print $2 }')
echo $PID
kill $PID
echo "Done"