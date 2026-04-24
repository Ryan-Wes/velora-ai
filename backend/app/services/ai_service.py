import os
import json
import re

from openai import OpenAI
from app.database import get_connection

api_key = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=api_key) if api_key else None


def get_category_catalog():
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT c.key, c.label, s.key as sub_key, s.label as sub_label
            FROM categories c
            LEFT JOIN subcategories s ON s.category_id = c.id
        """)

        rows = cursor.fetchall()

    catalog = {}

    for row in rows:
        cat_key = row["key"]
        cat_label = row["label"]

        if cat_key not in catalog:
            catalog[cat_key] = {
                "label": cat_label,
                "subcategories": []
            }

        if row["sub_key"]:
            catalog[cat_key]["subcategories"].append({
                "key": row["sub_key"],
                "label": row["sub_label"]
            })

    return catalog


def suggest_category(description: str):
    catalog = get_category_catalog()

    if client is None:
        return {
            "category_key": None,
            "subcategory_key": None,
            "confidence": "Baixa",
            "reason": "IA não configurada"
        }

    prompt = f"""
Você é um assistente de categorização financeira.

Dado:
Descrição da transação:
"{description}"

Catálogo disponível:
{catalog}

Responda com JSON puro e válido.
Não use markdown.
Não use ```json.
Não escreva explicações fora do JSON.

Use exatamente este formato:
{{
  "category_key": "...",
  "subcategory_key": "...",
  "confidence": "Alta",
  "reason": "..."
}}

Regras:
- escolha apenas categorias existentes no catálogo
- não invente categorias
- não invente subcategorias
- confidence deve ser apenas: Alta, Média ou Baixa
- reason deve ser curto e objetivo
"""

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "user", "content": prompt}
        ],
        temperature=0.2
    )

    content = response.choices[0].message.content.strip()

    cleaned_content = re.sub(r"^```json\s*", "", content)
    cleaned_content = re.sub(r"^```\s*", "", cleaned_content)
    cleaned_content = re.sub(r"\s*```$", "", cleaned_content).strip()

    return json.loads(cleaned_content)