import json
from docx import Document

source = r"work/contrato-referencia.docx"
target = r"src/contract-template.json"
doc = Document(source)
paragraphs = []
for paragraph in doc.paragraphs:
    paragraphs.append({
        "text": paragraph.text,
        "alignment": str(paragraph.alignment),
        "bold": bool(paragraph.runs) and all(run.bold is True for run in paragraph.runs if run.text.strip()),
    })
with open(target, "w", encoding="utf-8") as stream:
    json.dump(paragraphs, stream, ensure_ascii=False, indent=2)
