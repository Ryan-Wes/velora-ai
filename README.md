# 🚀 Velora AI

Clareza financeira com inteligência artificial.

Velora AI transforma extratos e faturas em insights claros — separando fluxo real de movimentações internas e mostrando para onde seu dinheiro está indo.

---

## 📦 Como rodar o projeto

### ⚠️ Pré-requisitos

Antes de começar, você precisa ter instalado:

- Python 3.10+
- Node.js (versão 18+)
- Git (opcional)

---

## 1. Baixar o projeto

Clique em **Code → Download ZIP**  
ou rode:

```
git clone https://github.com/SEU_USUARIO/SEU_REPO
```

---

## 2. Rodar o backend

Abra um terminal na pasta do projeto e rode:

```
cd backend

python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

Se tudo deu certo, você verá algo como:

```
Uvicorn running on http://127.0.0.1:8000
```

---

## 3. Rodar o frontend

Abra **outro terminal** e rode:

```
cd frontend

npm install
npm run dev
```

---

## 4. Acessar o sistema

Abra no navegador:

```
http://localhost:5173
```

---

## 💡 Como usar

1. Vá até a página de transações  
2. Envie um extrato ou fatura (PDF)  
3. Volte para o dashboard  
4. Veja os insights sendo gerados automaticamente  

---

## 🔒 Privacidade

Seus dados ficam **somente na sua máquina**.  
Nada é enviado para servidores externos.

---

## ⚠️ Possíveis problemas

- Se o backend não iniciar → verifique se o Python está instalado corretamente  
- Se o frontend falhar → verifique se o Node.js está instalado  
- Se algo não carregar → tente atualizar a página  

---

## 📌 Observação

Este é um projeto em evolução.  
Use dados de teste ou seus próprios extratos/faturas.
