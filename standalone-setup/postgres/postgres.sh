#!/bin/bash
sudo apt update -y
sudo apt install postgresql-14 -y
export PGPORT=5432
export PGUSER=postgres
export POSTGRES_HOST_AUTH_METHOD=trust
export POSTGRES_USER=postgres
sudo service postgresql status
sudo service postgresql start
sudo service postgresql status
