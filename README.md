# Z2Api Nest

Proxy API para Z.ai compatível com OpenAI e Anthropic, reescrito em NestJS para maior robustez e escalabilidade.

## 🚀 Funcionalidades

- **Compatibilidade OpenAI**: Endpoint `/v1/chat/completions` suportado.
- **Compatibilidade Anthropic**: Endpoint `/v1/messages` suportado.
- **Streaming SSE**: Respostas em tempo real com suporte a múltiplos modos de "thinking tags".
- **Upload de Imagens**: Suporte automático para processamento de imagens (base64) enviando para o upstream.
- **Segurança**: Geração de assinaturas HMAC-SHA256 integradas para requisições autenticadas.
- **Documentação**: Swagger integrado para fácil teste e exploração da API.

## 🛠️ Instalação

### Pré-requisitos

- Node.js (v20+)
- npm

### Passos

1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o arquivo `.env` (use o `.env.example` como base).
4. Inicie em modo de desenvolvimento:
   ```bash
   npm run start:dev
   ```

## 📚 Documentação (Swagger)

Após iniciar a aplicação, a documentação interativa estará disponível em:
`http://localhost:8080/api`

## 🐳 Docker

Para rodar via Docker Compose:

```bash
docker-compose up -d
```

## ⚙️ Configuração (.env)

| Variável          | Descrição                                                                 | Padrão      |
| ----------------- | ------------------------------------------------------------------------- | ----------- |
| `TOKEN`           | Token do Z.ai (vazio para modo anônimo)                                   | -           |
| `PORT`            | Porta do servidor                                                         | `8080`      |
| `THINK_TAGS_MODE` | Modo de processamento das tags (`reasoning`, `think`, `strip`, `details`) | `reasoning` |
| `MODEL`           | Modelo padrão                                                             | `glm-4.7`   |

---

Portado de `z2api-go`.
