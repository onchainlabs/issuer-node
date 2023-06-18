#!/bin/bash
ARG_1=$1
export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_API_ADDR=http://0.0.0.0:8200
export VAULT_ADDRESS=http://0.0.0.0:8200
vault write iden3/import/pbkey key_type=ethereum private_key=$ARG_1