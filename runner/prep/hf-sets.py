# Converts the Hugging Face sets downloaded into data/ (parquet/csv) into the items.jsonl files read by the runner.
# Usage: python runner/prep/hf-sets.py  (from the repo root; needs pyarrow). HLE images are written to data/hle/img/.
import base64, csv, json, os, pyarrow.parquet as pq

BENCH = os.path.join(os.path.dirname(__file__), '..', '..')
D = lambda *p: os.path.join(BENCH, 'data', *p)

def dump(path, rows):
    with open(path, 'w', encoding='utf8') as f:
        for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(path, len(rows))

for name in ['aime-2026', 'hmmt-feb-2026']:
    rows = pq.read_table(D(name, 'train.parquet')).to_pylist()
    dump(D(name, 'items.jsonl'), [{'id': f"{name}-{r['problem_idx']}", 'problem': r['problem'], 'answer': str(r['answer'])} for r in rows])

with open(D('gpqa', 'gpqa_diamond.csv'), encoding='utf8') as f:
    rows = list(csv.DictReader(f))
dump(D('gpqa', 'items.jsonl'), [{
    'id': r['Record ID'], 'question': r['Question'].strip(), 'correct': r['Correct Answer'].strip(),
    'incorrect': [r[f'Incorrect Answer {i}'].strip() for i in (1, 2, 3)],
} for r in rows])

os.makedirs(D('hle', 'img'), exist_ok=True)
out = []
for r in pq.read_table(D('hle', 'test.parquet'), columns=['id', 'question', 'image', 'answer', 'answer_type', 'category']).to_pylist():
    img = None
    if r['image']:
        head, b64 = r['image'].split(',', 1)
        ext = 'png' if 'png' in head else 'gif' if 'gif' in head else 'webp' if 'webp' in head else 'jpg'
        img = f"{r['id']}.{ext}"
        with open(D('hle', 'img', img), 'wb') as f: f.write(base64.b64decode(b64))
    out.append({'id': r['id'], 'question': r['question'], 'answer': r['answer'], 'answer_type': r['answer_type'], 'category': r['category'], 'image': img})
dump(D('hle', 'items.jsonl'), out)

# GAIA 2023 (gaia-benchmark/GAIA, gated): validation (165, with answers) and test (301, hidden answers; scored by the leaderboard server).
for sp in ['validation', 'test']:
    rows = pq.read_table(D('gaia', sp, 'metadata.parquet')).to_pylist()
    dump(D('gaia', sp, 'items.jsonl'), [{'id': r['task_id'], 'question': r['Question'], 'level': int(r['Level']), 'answer': r['Final answer'], 'file': r['file_name'] or None, 'split': sp} for r in rows])
