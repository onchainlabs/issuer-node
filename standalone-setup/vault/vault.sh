#!/bin/bash

wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update -y && sudo apt install vault -y


echo "VAULT CONFIGURATION SCRIPT"
echo "(scripts/init.sh):"
echo "===================================";

vault server -config=config/vault.json 1>&1 2>&1 &

# export VAULT_SKIP_VERIFY='true'

export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_API_ADDR=http://0.0.0.0:8200
export VAULT_ADDRESS=http://0.0.0.0:8200
# Parse unsealed keys
sleep 5

FILE=data/init.out
if [ ! -e "$FILE" ]; then
    echo -e "===== Initialize the Vault ====="
    vault operator init > data/init.out
fi

UNSEAL_KEY_1=$(grep "Unseal Key 1" data/init.out | cut -c 15-)
UNSEAL_KEY_2=$(grep "Unseal Key 2" data/init.out | cut -c 15-)
UNSEAL_KEY_3=$(grep "Unseal Key 3" data/init.out | cut -c 15-)
UNSEAL_KEY_4=$(grep "Unseal Key 4" data/init.out | cut -c 15-)
UNSEAL_KEY_5=$(grep "Unseal Key 5" data/init.out | cut -c 15-)

TOKEN=$(grep "Token" data/init.out | cut -c 21-)

echo -e "\n===== Unseal the Vault ====="

vault operator unseal $UNSEAL_KEY_1
vault operator unseal $UNSEAL_KEY_2
vault operator unseal $UNSEAL_KEY_3

vault login $TOKEN
vault secrets enable -path=secret/ kv-v2
echo -e "\n===== ENABLED KV secrets ====="

IDEN3_PLUGIN_PATH="plugins/vault-plugin-secrets-iden3"

if [ ! -e "$IDEN3_PLUGIN_PATH" ]; then
    echo "===== IDEN3 Plugin not found: downloading... ====="
    IDEN3_PLUGIN_ARCH=amd64
    IDEN3_PLUGIN_VERSION=0.0.6
    if [ `uname -m` == "aarch64" ]; then
        IDEN3_PLUGIN_ARCH=arm64
    fi
    VAULT_IDEN3_PLUGIN_URL="https://github.com/iden3/vault-plugin-secrets-iden3/releases/download/v${IDEN3_PLUGIN_VERSION}/vault-plugin-secrets-iden3_${IDEN3_PLUGIN_VERSION}_linux_${IDEN3_PLUGIN_ARCH}.tar.gz"
    wget -q -O - ${VAULT_IDEN3_PLUGIN_URL} | tar -C plugins/ -xzf - vault-plugin-secrets-iden3
fi

# apk add -q openssl
sudo apt-get install openssl -y
IDEN3_PLUGIN_SHA256=`openssl dgst -r -sha256 ${IDEN3_PLUGIN_PATH} | awk '{print $1}'`
vault plugin register -sha256=$IDEN3_PLUGIN_SHA256 vault-plugin-secrets-iden3
vault secrets enable -path=iden3 vault-plugin-secrets-iden3

chmod 755 file -R

echo "===== ENABLED IDEN3 ====="
export vault_token="token:${TOKEN}"
echo $vault_token

tail -f /dev/null