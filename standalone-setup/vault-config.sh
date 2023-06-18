#!/bin/bash
chmod +x vault/vault.sh
cd vault; nohup ./vault.sh > vault.log &
