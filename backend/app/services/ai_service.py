import os
import json
import re

from openai import OpenAI
from app.database import get_connection
from app.services.learning_service import (
    find_learned_rule,
    get_recent_examples,
    load_learned_rules,
)

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


def format_user_examples(user_id: str) -> str:
    examples = get_recent_examples(user_id)

    if not examples:
        return ""

    lines = [
        f'- "{example["pattern"]}" -> {example["main_category"]} / {example["subcategory"]}'
        for example in examples
    ]

    return (
        "Decisões anteriores deste usuário (siga o mesmo critério quando for parecido):\n"
        + "\n".join(lines)
        + "\n"
    )


def suggest_category(description: str, user_id: str):
    # Se o usuário já classificou este estabelecimento, não precisa perguntar para a IA
    learned_rule = find_learned_rule(load_learned_rules(user_id), description)

    if learned_rule:
        return {
            "category_key": learned_rule["main_category"],
            "subcategory_key": learned_rule["subcategory"],
            "confidence": "Alta",
            "reason": "Você já classificou assim antes",
        }

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

{format_user_examples(user_id)}
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
- as decisões anteriores do usuário, quando existirem, têm prioridade sobre o seu palpite
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