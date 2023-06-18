.PHONY: clean-vault
clean-vault:
	rm -R vault/data/init.out
	rm -R vault/file/core/
	rm -R vault/file/logical/
	rm -R vault/file/sys/

.PHONY: kill-vault
kill-vault:
	@chmod +x kill.sh
	@./kill.sh

.PHONY: vault-config
vault-config:
	@chmod +x vault-config.sh
	@./vault-config.sh	
	
.PHONY: postgres-config
postgres-config:
	@chmod +x postgres-config.sh
	@./postgres-config.sh

.PHONY: redis-config
redis-config:
	@chmod +x redis-config.sh
	@./redis-config.sh		