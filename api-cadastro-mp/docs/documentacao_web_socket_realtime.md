# Documentação – WebSocket (Tempo Real)

## 1. Visão Geral

O módulo de **WebSocket** permite comunicação em tempo real entre backend e frontend, eliminando a necessidade de polling constante. Ele é utilizado principalmente para:

- Atualização automática de mensagens em conversas
- Atualização de badges de mensagens não lidas
- Notificação de criação/atualização de conversas
- Sincronização entre múltiplos usuários conectados

Neste projeto, o WebSocket é implementado utilizando **Socket.IO** no backend Flask e o cliente Socket.IO no frontend React.

---

## 2. Objetivos do WebSocket no Projeto

- Reduzir chamadas HTTP repetitivas (polling)
- Melhorar experiência do usuário (UX tipo Teams/Slack)
- Garantir consistência de estado entre usuários
- Permitir crescimento futuro (typing indicator, presença online, etc.)

---

## 3. Arquitetura Geral

```text
Frontend (React)
  └── socket.io-client
        ⇅ eventos
Backend (Flask)
  └── Flask-SocketIO
        └── Notifiers (ConversationNotifier / MessageNotifier)
```

### Princípio
- **Services** disparam eventos de domínio
- **Notifiers** traduzem eventos para WebSocket
- **Routes** não conhecem WebSocket

---

## 4. Backend – Estrutura

### 4.1 Dependências

```bash
pip install flask-socketio
```

### 4.2 Inicialização do Socket.IO

Arquivo típico: `app/main.py`

```python
from flask_socketio import SocketIO

socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode="eventlet",
)

socketio.init_app(app)
```

> O `socketio` deve ser instanciado **uma única vez**.

---

## 5. Notifiers (Camada de Integração)

### 5.1 Conceito

Notifiers são responsáveis por:
- Receber eventos do Service
- Publicar eventos WebSocket

Eles evitam acoplamento entre domínio e infraestrutura.

---

### 5.2 ConversationNotifier

Arquivo: `conversation_notifier.py`

Eventos emitidos:

| Evento | Quando ocorre |
|------|--------------|
| `conversation_created` | Nova conversa criada |
| `conversation_updated` | Conversa atualizada |
| `conversation_deleted` | Conversa removida |

Exemplo:

```python
class SocketIOConversationNotifier(ConversationNotifier):
    def conversation_created(self, conversation):
        socketio.emit(
            "conversation_created",
            conversation,
            broadcast=True,
        )
```

---

### 5.3 MessageNotifier

Arquivo: `message_notifier.py`

Eventos emitidos:

| Evento | Quando ocorre |
|------|--------------|
| `message_created` | Nova mensagem |
| `message_read` | Mensagens marcadas como lidas |

Exemplo:

```python
class SocketIOMessageNotifier(MessageNotifier):
    def message_created(self, message):
        socketio.emit(
            "message_created",
            message,
            room=f"conversation:{message.conversation_id}",
        )
```

---

## 6. Backend – Rooms

### Conceito

Rooms permitem emitir eventos apenas para usuários interessados.

Padrão adotado:

- `conversation:{conversation_id}` → usuários daquela conversa
- `user:{user_id}` → notificações privadas

Exemplo:

```python
socketio.emit(
    "message_created",
    payload,
    room="conversation:1",
)
```

---

## 7. Frontend – Estrutura

### 7.1 Dependência

```bash
npm install socket.io-client
```

---

### 7.2 Inicialização do Socket

Arquivo sugerido: `src/app/realtime/socket.js`

```javascript
import { io } from "socket.io-client";
import { env } from "../config/env";

export const socket = io(env.apiBaseUrl, {
  transports: ["websocket"],
  autoConnect: false,
});
```

---

### 7.3 Conexão Autenticada

Após login:

```js
socket.auth = { token: accessToken };
socket.connect();
```

No logout:

```js
socket.disconnect();
```

---

## 8. Eventos no Frontend

### 8.1 Nova mensagem

```js
socket.on("message_created", (message) => {
  // adiciona mensagem no chat
});
```

### 8.2 Mensagens lidas

```js
socket.on("message_read", ({ conversation_id, message_ids }) => {
  // atualiza estado local
});
```

### 8.3 Conversa criada

```js
socket.on("conversation_created", (conversation) => {
  // adiciona card na lista
});
```

---

## 9. Integração com ConversationsPage

Fluxo esperado:

1. Usuário abre conversa
2. Frontend entra no room:

```js
socket.emit("join_conversation", { conversation_id });
```

3. Backend adiciona usuário ao room
4. Novas mensagens chegam automaticamente

---

## 10. Autorização no WebSocket

### Backend

No evento `connect`:

```python
@socketio.on('connect')
def on_connect(auth):
    token = auth.get('token')
    # validar JWT
```

### Frontend

Token enviado automaticamente via `socket.auth`.

---

## 11. Fallback (Sem WebSocket)

Caso o WebSocket esteja indisponível:

- Frontend continua funcionando com HTTP + polling
- WebSocket é apenas uma camada de otimização

---

## 12. Boas Práticas

- Nunca acessar banco dentro de handlers Socket.IO
- Sempre usar Services + Notifiers
- Não confiar em dados enviados pelo cliente
- Emitir apenas DTOs (schemas de resposta)

---

## 13. Próximas Evoluções

- Indicador de digitação (`typing`)
- Presença online (`user_online`)
- Confirmação de entrega (double check)
- Escalonamento com Redis (Socket.IO adapter)

---

## 14. Resumo

O WebSocket neste projeto:
- É desacoplado da camada HTTP
- Usa eventos de domínio
- Escala para funcionalidades avançadas
- Elimina polling excessivo

Ele é o caminho natural para UX moderna no módulo de conversas.

