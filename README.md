# Prospera Frontend

Aplicação frontend moderna desenvolvida em **Angular 20** para a plataforma de treinamento Prospera. O projeto implementa uma arquitetura escalável com componentes standalone, lazy-loading de rotas e separação clara de responsabilidades.

## Sobre o Projeto

Prospera é uma plataforma educacional que oferece:
- 📚 Catálogo de cursos e treinamentos
- 👥 Gerenciamento de contas e assinaturas
- 🎓 Visualização de conteúdo educacional (suporte a PDF)
- 🔐 Autenticação e autorização (com guards de rota)
- ⚙️ Painel administrativo para gestão de conteúdo
- 📅 Agenda de eventos e atividades
- 💬 Sistema de suporte e FAQs

## Estrutura do Projeto

```
src/
├── app/
│   ├── core/                 # Serviços, guards, interceptadores e utilitários
│   │   ├── guards/          # auth.guard, admin.guard
│   │   ├── interceptors/    # HTTP interceptors (autenticação)
│   │   ├── models/          # Interfaces e tipos TypeScript
│   │   ├── pipes/           # Custom pipes
│   │   ├── services/        # Serviços de API e lógica de negócio
│   │   └── utils/           # Utilitários (JWT, etc.)
│   ├── features/            # Componentes de página (lazy-loaded)
│   │   ├── home/           # Página inicial
│   │   ├── catalog/        # Catálogo de cursos
│   │   ├── trainings/      # Lista de treinamentos do usuário
│   │   ├── account/        # Conta, assinatura e perfil
│   │   ├── admin/          # Painel administrativo
│   │   ├── content/        # Visualizador de conteúdo
│   │   ├── plans/          # Planos e preços
│   │   ├── auth/           # Modais de autenticação
│   │   └── [outros]/       # About, Contact, FAQ, Support, etc.
│   ├── shared/              # Componentes reutilizáveis
│   │   ├── components/     # Componentes compartilhados
│   │   ├── pipes/          # Pipes reutilizáveis
│   │   └── styles/         # Estilos globais
│   ├── app.ts              # Componente raiz
│   ├── app.routes.ts       # Configuração de rotas
│   └── app.config.ts       # Configuração da aplicação
├── assets/                  # Imagens, documentos, worker scripts
├── index.html              # Arquivo HTML raiz
├── main.ts                 # Entry point
└── styles.scss             # Estilos globais
```

## Stack Tecnológico

- **Framework**: Angular 20.3.0
- **Linguagem**: TypeScript 5.9.2
- **Estilo**: SCSS
- **Testes**: Karma + Jasmine
- **Linting**: Configuração de lint do Angular CLI
- **Formatting**: Prettier
- **PDF Viewer**: pdfjs-dist 5.4.296
- **Node**: 20.x

## Serviços Principais

| Serviço | Responsabilidade |
|---------|-----------------|
| `AuthService` | Autenticação, login, logout, JWT |
| `ApiService` | Requisições HTTP com interceptadores |
| `CatalogService` | Catálogo de cursos e produtos |
| `TrainingService` | Treinamentos inscritos do usuário |
| `SubscriptionService` | Gerenciamento de assinaturas |
| `AdminService` | Operações administrativas |
| `SupportService` | Suporte ao usuário |
| `LessonService` | Aulas e conteúdo educacional |

## Configuração e Instalação

### Pré-requisitos

- Node.js 20.x
- npm ou yarn

### Instalação

```bash
# Clonar repositório e instalar dependências
npm ci

# Ou com npm install para instalar versão mais recente
npm install
```

## Desenvolvimento

### Iniciar servidor de desenvolvimento

```bash
npm start
```

Acesse `http://localhost:4200/` no navegador. O aplicativo fará hot-reload automaticamente ao salvar alterações.

Alternativa com Angular CLI:
```bash
ng serve
```

### Build para produção

```bash
npm run build
```

Saída otimizada será gerada em `dist/Prospera-frontend/`.

### Watch mode (desenvolvimento contínuo)

```bash
npm run watch
```

## Testes

### Testes Unitários

```bash
npm test
```

Executa testes com Karma e Jasmine. Monitora arquivos continuamente.

## Rotas Principais

| Rota | Autenticação | Descrição |
|------|-------------|-----------|
| `/` | Não | Página inicial |
| `/catalog` | Não | Catálogo de cursos |
| `/planos` | Não | Planos e preços |
| `/conta` | Sim | Conta do usuário |
| `/conta/assinatura` | Sim | Gerenciar assinatura |
| `/trainings` | Sim | Meus treinamentos |
| `/conteudo/visualizar/:id` | Sim | Visualizar aula |
| `/admin` | Sim (Admin) | Painel administrativo |

## Autenticação e Autorização

- **Guards de Rota**: `authGuard` (autenticado), `adminGuard` (administrador)
- **Interceptador HTTP**: Adiciona token JWT em requisições
- **Utilitário JWT**: Decodificação e validação de tokens
- **Token Storage**: Armazenado localmente no navegador

## Componentes Destacados

- **Header & Footer**: Layout base com navegação
- **Auth Modal**: Modais de login, registro e recuperação de senha
- **Catalog Details Modal**: Prévia de cursos
- **PDF Viewer**: Visualizador seguro de documentos PDF
- **Admin Dashboard**: Interface de gerenciamento

## Padrões e Boas Práticas

✅ Componentes standalone (Angular 14+)
✅ Lazy-loading de rotas para melhor performance
✅ Serviços injetáveis com DI
✅ RxJS para programação reativa
✅ Separação clara entre camadas (apresentação, lógica, dados)
✅ Tipagem forte com TypeScript
✅ SCSS para estilos modularizados
✅ Guards para proteção de rotas
✅ Interceptadores para autenticação

## Deploy

A aplicação é automaticamente deployada no **Vercel** a cada push no repositório principal.

**URL de produção**: [Prospera-frontend.vercel.app](https://prospera-frontend.vercel.app)

## Scripts Disponíveis

```json
{
  "start": "ng serve",
  "build": "ng build --configuration production",
  "watch": "ng build --watch --configuration development",
  "test": "ng test"
}
```

## Licença

Este projeto é **proprietário e confidencial**. Todos os direitos reservados © 2026 Brena Bispo Soares.

A cópia, modificação, distribuição ou qualquer uso não autorizado deste código é **estritamente proibido**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

## Desenvolvido por

**Brena Soares** - Analista e Desenvolvedora de Sistemas  
[LinkedIn](https://www.linkedin.com/in/brenasoares/)