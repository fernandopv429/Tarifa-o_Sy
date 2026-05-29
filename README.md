# SmartOS - Sistema de Gestão de Ordens de Serviço

Bem-vindo ao **SmartOS**, um sistema web moderno e completo para gestão de ordens de serviço (O.S.), histórico de equipamentos, usuários, telemetria e muito mais, desenvolvido em Node.js com React.

## 🚀 Tecnologias Utilizadas

O sistema foi construído utilizando as seguintes tecnologias:

### Frontend
- **React.js (v19)** - Biblioteca principal para construção da interface.
- **Vite** - Ferramenta de build e servidor de desenvolvimento super rápido.
- **Tailwind CSS (v4)** - Framework CSS utilitário para uma estilização moderna, responsiva e rápida.
- **Lucide React** - Ícones limpos e profissionais.
- **TypeScript** - Adicionando tipagem estática para maior segurança e facilidade na manutenção do código.

### Backend
- **Node.js + Express** - Servidor em Node.js usando o framework Express para roteamento de APIs REST.
- **MySQL2** - Driver para conexão de alta performance com o banco de dados relacional MySQL.
- **CORS & dotenv** - Middlewares e pacotes para proteção de rotas e injeção de conexões seguras.
- **esbuild** - Utilizado para o *bundling* rápido do servidor Node para produção.

### Banco de Dados
- **MySQL** - Banco de dados relacional, lidando com a integridade das tabelas de *usuários* e *histórico de dispositivos*.

### Implantação e Deploy
- **Docker & Docker Compose** - A aplicação possui contêineres e um arquivo Compose pronto, facilitando sumariamente a orquestração do banco de dados junto da aplicação. 

## ⚙️ Principais Funcionalidades

1. **Dashboard de Equipamentos (Usuários):** 
   - Usuários podem se logar (ou consultar diretamente, caso configurado) e gerenciar os seus dispositivos cadastrados.
   - Listagem agrupada pela última posição e histórico realçado de ordens de serviços, eventos e builds.

2. **Interface do Administrador (Master):**
   - Possui controle global de todos os usuários do banco de dados.
   - Pode adicionar novos dispositivos visualmente, ou importar lotes de ordens de serviço limpas e processadas via JSON.
   - Lista geral de todo o histórico, possibilitando editar, apagar, ou corrigir o MAC address de placas sem dono.

3. **Autenticação Flexível:**
   - Senhas criptografadas (bcrypt).
   - Senha "Admin Secret" (Configurada nas variáveis do servidor) para acesso administrativo, simplificando os processos do dono da máquina, não necessitando criar um "Super Usuário" inicialmente.

4. **Instalação / Configuração Automática de Tabelas:**
   - Botões presentes na área administrativa que forçam e configuram (CREATE TABLE IF NOT EXISTS) automaticamente o banco de dados sem a necessidade de comandos manuais no terminal.

## 📦 Como Instalar / Fazer o Deploy

Leia também o [DEPLOY.md](DEPLOY.md) para detalhes mais intrínsecos de instalação caso vá hospedar em numa VPS (ex. AWS, DigitalOcean).

```bash
# 1. Copie as variáveis de ambiente
cp .env.example .env

# 2. Rode o Docker Compose!
docker-compose up -d --build
```

Acesse em `http://localhost:3000`.

## 👨‍💻 Desenvolvedor e Autor

**NexusHubDev**
- **Desenvolvedor:** Fernando Batista
- **Site:** [https://nexusdevhub.com/](https://nexusdevhub.com/)
- **LinkedIn:** [https://www.linkedin.com/in/fernandonascimentobatista/](https://www.linkedin.com/in/fernandonascimentobatista/)

## 🤝 Contribuição
Fique à vontade para aprimorar, abrir issues ou submeter PRs. 

Licença MIT.
