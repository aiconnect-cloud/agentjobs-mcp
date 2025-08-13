#!/usr/bin/env fish

# 🔍 Script de Debug para MCP Server
# Este script facilita o debug do MCP Server com diferentes configurações

function show_help
    echo "🔍 MCP Debug Helper"
    echo ""
    echo "Uso: ./debug.fish [opção]"
    echo ""
    echo "Opções:"
    echo "  help          Mostra esta ajuda"
    echo "  config        Mostra configuração atual"
    echo "  test          Testa carregamento das tools"
    echo "  debug         Inicia em modo debug completo"
    echo "  debug-with-env Inicia debug usando .env.debug"
    echo "  quick         Debug rápido (apenas carregamento)"
    echo ""
    echo "Variáveis de ambiente úteis:"
    echo "  MCP_DEBUG=true        Habilita logs detalhados"
    echo "  AICONNECT_API_KEY     Chave da API"
    echo "  AICONNECT_API_URL     URL da API"
end

function check_build
    if not test -d build
        echo "⚠️  Projeto não compilado. Compilando..."
        npm run build
    end
end

switch $argv[1]
    case "help" ""
        show_help

    case "config"
        echo "🔧 Verificando configuração..."
        check_build
        npm run cli:config

    case "test"
        echo "🧪 Testando carregamento das tools..."
        check_build
        npm run test:tools

    case "debug"
        echo "🔍 Iniciando modo debug completo..."
        check_build
        set -x MCP_DEBUG true
        npm run debug

    case "debug-with-env"
        if test -f .env.debug
            echo "🔍 Iniciando debug com .env.debug..."
            check_build
            source .env.debug
            npm run debug
        else
            echo "❌ Arquivo .env.debug não encontrado!"
            echo "💡 Crie o arquivo .env.debug baseado em .env.example"
        end

    case "quick"
        echo "⚡ Debug rápido - verificando estrutura..."
        check_build
        echo ""
        echo "1. 📋 Configuração:"
        npm run cli:config
        echo ""
        echo "2. 🧪 Tools:"
        npm run test:tools

    case '*'
        echo "❌ Opção inválida: $argv[1]"
        echo ""
        show_help
end
