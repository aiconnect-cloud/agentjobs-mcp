#!/usr/bin/env bash
set -euo pipefail
# carrega variáveis do .env para o ambiente
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
# entra na raiz do projeto (caso seja chamado de outro lugar)
cd "$(dirname "$0")"
# inicia o servidor MCP (stdio)
exec node build/index.js
