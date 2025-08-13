# 🔍 Guia de Debug do MCP Server

Este guia fornece várias maneiras de depurar e diagnosticar problemas no seu MCP Server.

## 🚀 Comandos de Debug Disponíveis

### 1. Debug Básico
```bash
# Compilar e rodar em modo debug
npm run debug

# Debug com variáveis de ambiente específicas
MCP_DEBUG=true npm run debug
```

### 2. Testar Tools
```bash
# Verificar se todas as tools estão carregando
npm run test:tools

# Verificar configuração atual
npm run cli:config
```

### 3. Debug com Logs Detalhados
```bash
# Usar arquivo de ambiente de debug
cp .env.debug .env
# Editar .env com suas credenciais
npm run debug
```

## 🛠️ Tipos de Debug

### 1. **Debug de Configuração**
```bash
npm run cli:config
```
Este comando mostra:
- URL da API
- Status da chave de API
- Versão do Node.js
- Versão do MCP Server

### 2. **Debug de Carregamento de Tools**
```bash
npm run test:tools
```
Este comando:
- Lista todas as tools encontradas
- Testa o carregamento de cada tool
- Mostra erros de carregamento se houver

### 3. **Debug Completo em Runtime**
```bash
MCP_DEBUG=true npm run debug
```
Com `MCP_DEBUG=true`, você verá:
- Logs de inicialização detalhados
- Configuração carregada
- Chamadas de tools em tempo real
- Respostas das APIs
- Erros detalhados

## 📊 Interpretando os Logs

### Logs de Tool
```
[MCP-DEBUG 2025-08-13T...] [INFO] Tool called: get_jobs_stats
[MCP-DEBUG 2025-08-13T...] [DEBUG] Data: {"org_id":"aiconnect"}
```

### Logs de API
```
[MCP-DEBUG 2025-08-13T...] [DEBUG] HTTP GET https://api.aiconnect.cloud/api/v0/jobs/stats
[MCP-DEBUG 2025-08-13T...] [DEBUG] HTTP Response GET [200]
```

### Logs de Erro
```
[MCP-DEBUG 2025-08-13T...] [ERROR] Tool error: get_jobs_stats
[MCP-DEBUG 2025-08-13T...] [ERROR] Data: {"error": "API key not provided"}
```

## 🔧 Problemas Comuns e Soluções

### 1. **API Key não configurada**
**Erro:** `API key not provided`
**Solução:**
```bash
# Definir a chave de API
export AICONNECT_API_KEY="sua-chave-aqui"
npm run debug
```

### 2. **URL da API incorreta**
**Erro:** `Request failed with status 404`
**Solução:**
```bash
# Verificar/definir URL da API
export AICONNECT_API_URL="https://api.aiconnect.cloud/api/v0"
npm run debug
```

### 3. **Tools não carregando**
**Erro:** `Error loading tools`
**Solução:**
```bash
# Verificar se o build está atualizado
npm run build
npm run test:tools
```

### 4. **Problemas de Conexão MCP**
**Erro:** `Transport connection closed`
**Solução:**
- Verificar se o cliente MCP está conectado corretamente
- Usar logs de debug para ver detalhes da conexão

## 📝 Configuração para Claude Desktop

Para debug no Claude Desktop, use esta configuração no `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentjobs-debug": {
      "command": "node",
      "args": ["/caminho/para/agentjobs-mcp/build/debug.js"],
      "env": {
        "MCP_DEBUG": "true",
        "AICONNECT_API_KEY": "sua-chave-aqui",
        "AICONNECT_API_URL": "https://api.aiconnect.cloud/api/v0",
        "DEFAULT_ORG_ID": "aiconnect"
      }
    }
  }
}
```

## 🧪 Testes de Funcionalidade

### Teste Manual das Tools

1. **Listar Jobs:**
   - Comando: "List all jobs"
   - Debug: Verificar se a API é chamada e se os dados são formatados

2. **Buscar Job Específico:**
   - Comando: "Get job details for job-123"
   - Debug: Verificar parâmetros enviados e resposta recebida

3. **Criar Job:**
   - Comando: "Create a new job"
   - Debug: Verificar payload da criação e resposta

### Teste de Configuração

```bash
# Verificar todas as configurações
npm run cli:config

# Verificar carregamento das tools
npm run test:tools

# Verificar versão
npm run cli:version
```

## 🎯 Dicas de Debug

1. **Use logs incrementais:** Comece com debug básico e aumente verbosidade conforme necessário

2. **Teste isoladamente:** Use `npm run test:tools` para verificar carregamento antes de testar funcionalidade

3. **Monitore a API:** Se possível, monitore logs da API AI Connect em paralelo

4. **Verifique configuração:** Sempre rode `npm run cli:config` primeiro

5. **Use ambiente controlado:** Use `.env.debug` para configuração consistente

## 📋 Checklist de Debug

- [ ] Configuração carregada corretamente (`npm run cli:config`)
- [ ] Tools carregando sem erro (`npm run test:tools`)  
- [ ] API key configurada
- [ ] URL da API acessível
- [ ] Logs de debug habilitados (`MCP_DEBUG=true`)
- [ ] Conexão MCP funcionando
- [ ] Tools respondendo conforme esperado

## 🆘 Debugging Avançado

Para problemas complexos, você pode:

1. **Adicionar mais logs** nas tools específicas
2. **Usar Node.js debugger** com `--inspect`
3. **Monitorar requisições HTTP** com `DEBUG=axios`
4. **Verificar memória e performance** com `node --trace-warnings`

---

💡 **Lembre-se:** O debug é mais eficiente quando feito de forma incremental, testando cada componente isoladamente antes de testar o sistema completo.
