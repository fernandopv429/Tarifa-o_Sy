# Instruções para Implantação em Servidor (Deploy)

Este guia explica como fazer o deploy deste sistema personalizado em seu próprio servidor (ex: VPS, Ubuntu, DigitalOcean, EC2).

## 1. Pré-requisitos

Certifique-se de que os seguintes componentes estão instalados em seu servidor:
- **Node.js** (v18 ou superior)
- **npm** (já vem com o Node.js)
- **Banco de Dados MySQL**: Banco de dados MySQL já criado em seu servidor. Ex:
  - Você pode instalar o MySQL Server: `sudo apt install mysql-server`
  - Certifique-se de copiar `.env.example` para `.env` e preencher as variáveis.

## 2. Configuração

Clone o repositório ou transfira os arquivos para o seu servidor.
Na raiz do projeto, crie um arquivo `.env` copiando o arquivo `.env.example`:

```bash
cp .env.example .env
```

Abra o arquivo `.env`, edite o `DATABASE_URL` com as suas credenciais originais do MySQL, e configure o `ADMIN_SECRET`:

```env
DATABASE_URL="mysql://usuario:senha@localhost:3306/nome_do_banco"
ADMIN_SECRET="admin123"
```

> **Nota:** O `ADMIN_SECRET` é usado para criar novos usuários, gerenciar todos os dispositivos globalmente e para as tarefas de configuração técnica pelo painel do frontend.

## 3. Instalação das Dependências e Compilação (Build)

Instale os pacotes npm e crie a compilação de produção (esta etapa compilará o aplicativo React frontend e o backend Node customizado).

```bash
npm install
npm run build
```

Isto irá gerar todos os arquivos de produção para a pasta `dist/`.

## 4. Rodando o Servidor

Para iniciar seu servidor de produção, use:

```bash
npm run start
```

Por padrão o servidor roda na porta 3000.
Você pode usar o **PM2** (um gerenciador de processos Node) para mantê-lo rodando de fundo e reiniciar junto com o servidor em quedas:

```bash
# Instale o pm2
sudo npm install -g pm2

# Rode usando o pm2
pm2 start "npm run start" --name "smartos-app"
```

## 5. Proxy Reverso do Nginx (Opcional, mas Recomendado)

Para que seu serviço seja acessível na porta 80 (HTTP) ou 443 (HTTPS) usando um domínio customizado, configure o nginx da seguinte forma:

```nginx
server {
    listen 80;
    server_name seu_dominio.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 6. Deploy via Docker e Docker Compose (Modo Recomendado)

Você também pode subir o sistema inteiro (Aplicação + Banco de Dados MySQL Isolado) em poucos minutos usando Docker.

1. **Instale o Docker e o Docker Compose** no seu servidor.
2. Clone este repositório ou envie os arquivos para o servidor.
3. No diretório raiz do projeto, suba os ambientes:

```bash
docker-compose up -d --build
```

O contêiner do MySQL (`smartos_db`) será iniciado, e em seguida a nossa aplicação (`smartos_app`) compilará e rodará na porta `3000`.
*(Nota: as senhas e usuários do MySQL e configurações já estão pré-configuradas no \`docker-compose.yml\`, você preferencialmente deve alterá-las lá caso vá usar em ambiente real de produção).*

* Para acompanhar os dados rodando (logs): `docker-compose logs -f app`
* Após o sistema rodar, acesse o painel pelo seu navegador (em `http://seu-ip:3000`), vá em **Admin / Configuração**, e digite a senha padrão `admin123` e clique em **Configurar Tabelas (Auto-Setup)** no painel de administração para criar as tabelas MySQL iniciais.
