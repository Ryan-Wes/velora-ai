# 💜 Velora AI  
Clareza financeira com inteligência artificial.

Velora AI é um dashboard financeiro inteligente que transforma extratos bancários e faturas em insights visuais, categorização automática e análise clara dos seus gastos.

---

## 🚀 Demonstração

🔗 (adicione aqui quando fizer deploy)

---

## ✨ Funcionalidades

### 📊 Dashboard inteligente
- Visão geral de entradas, saídas e saldo
- Gráficos interativos (mensal e diário)
- Análise por categoria com donut dinâmico
- Top gastos com agrupamento inteligente

---

### 🧠 Insights automatizados
- Geração de insights baseada nos dados do usuário
- Mensagens contextuais (ex: categoria dominante, saldo positivo/negativo)
- Tooltip inteligente com interpretação dos dados

---

### 🗂️ Importação de dados
- Upload de PDFs (extratos e faturas)
- Parser específico para Nubank
- Suporte a múltiplos meses
- Detecção automática de tipo de arquivo

---

### 🎨 Personalização de categorias
- Sistema de categorias persistido em banco
- Edição de categorias e subcategorias
- 🎯 Customização de cor por categoria (impacta gráficos e UI)
- Atualização dinâmica sem reset de banco

---

### 🔐 Autenticação
- Login com Supabase
- Isolamento de dados por usuário (preparado para multiusuário)

---

## 🧱 Arquitetura

### Backend
- FastAPI
- SQLite (MVP) → preparado para PostgreSQL
- Parser modular de arquivos
- API REST estruturada

### Frontend
- React (Vite)
- Recharts (gráficos)
- CSS custom (tema dark roxo)
- UX focada em clareza e fluidez

---

## 📂 Estrutura do projeto

```
backend/
  app/
    routes/
    services/
    parsers/
    utils/

frontend/
  src/
    components/
    pages/
    styles/
    utils/
```

---

## ⚙️ Como rodar localmente

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/velora-ai.git
cd velora-ai
```

---

### 2. Backend

```bash
cd backend

python -m venv venv
venv\Scripts\activate  # Windows

pip install -r requirements.txt

uvicorn app.main:app --reload
```

Backend rodando em:
http://localhost:8000

Swagger:
http://localhost:8000/docs

---

### 3. Frontend

```bash
cd frontend

npm install
npm run dev
```

Frontend:
http://localhost:5173

---

## 🔌 Variáveis de ambiente

### Backend (.env)

```
OPENAI_API_KEY=your_key_here
```

---

### Frontend (.env)

```
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## 🧠 Decisões técnicas importantes

- Uso de base **caixa** (cash flow real)
- Faturas de cartão só contam quando pagas
- Investimentos não entram como gasto
- Sistema preparado para múltiplos bancos no futuro
- Categorias persistidas no banco (não hardcoded)

---

## 🚀 Roadmap

- [ ] Multiusuário completo
- [ ] Deploy público
- [ ] Integração com mais bancos
- [ ] Importação manual de transações
- [ ] IA para categorização automática (RAG)
- [ ] Exportação para Excel
- [ ] Insights mais avançados

---

## 🧑‍💻 Autor

Ryan Lopes  
🔗 LinkedIn: https://www.linkedin.com/in/wryan-lopes/  
🔗 Portfólio: https://ryan-wes.github.io/portfolio/

---

## 💬 Sobre o projeto

Este projeto foi desenvolvido com foco em aprendizado prático, arquitetura real de produto e experiência do usuário.
