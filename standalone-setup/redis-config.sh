#!/bin/bash
sudo apt update
sudo apt install redis-server
sudo service redis-server status
sudo service redis-server start
sudo service redis-server status
