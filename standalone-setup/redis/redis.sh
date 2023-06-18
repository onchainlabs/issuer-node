#!/bin/bash
FILE_NAME=redis-6.0.14.tar.gz
sudo apt update -y
sudo apt install build-essential tcl -y
wget http://download.redis.io/releases/redis-6.0.14.tar.gz -P $HOME/opt/
tar xzf $HOME/opt/$FILE_NAME -C $HOME/opt/
cd $HOME/opt/
make
sudo make install
rm -r $HOME/opt/
