from pathlib import Path
import re

path = Path('DEPLOYMENT_CHECKLIST.md')
text = path.read_text(encoding='utf-8')

replacements = {
    r'https://supabase\.com': '[supabase.com](https://supabase.com)',
    r'https://dashboard\.stripe\.com/products': '[dashboard.stripe.com/products](https://dashboard.stripe.com/products)',
    r'https://cloud\.google\.com/console': '[cloud.google.com/console](https://cloud.google.com/console)',
    r'https://platform\.openai\.com/api-keys': '[platform.openai.com/api-keys](https://platform.openai.com/api-keys)',
    r'https://serpapi\.com': '[serpapi.com](https://serpapi.com)',
    r'https://resend\.com': '[resend.com](https://resend.com)',
    r'https://www\.monarch-supercars\.app': '[www.monarch-supercars.app](https://www.monarch-supercars.app)'
}

for pattern, replacement in replacements.items():
    text = re.sub(pattern, replacement, text)

lines = text.splitlines()
out = []
in_code = False
for line in lines:
    stripped = line.strip()
    if stripped.startswith('```'):
        if stripped == '```':
            line = '```text'
        elif stripped == '```bash' or stripped == '```sql' or stripped == '```text':
            line = stripped
        else:
            line = '```text'
        if out and out[-1].strip() != '':
            out.append('')
        out.append(line)
        in_code = not in_code
        continue

    if in_code:
        out.append(line)
        continue

    if stripped.startswith('#'):
        if out and out[-1].strip() != '':
            out.append('')
        out.append(line)
        continue

    if out and out[-1].strip() == '' and stripped == '':
        continue

    out.append(line)

final = []
inside_fence = False
for i, line in enumerate(out):
    final.append(line)
    if line.strip().startswith('```'):
        if inside_fence and i + 1 < len(out) and out[i + 1].strip() != '':
            final.append('')
        inside_fence = not inside_fence

fixed_text = '\n'.join(final).replace('\r\n', '\n') + '\n'
path.write_text(fixed_text, encoding='utf-8')
print('fixed DEPLOYMENT_CHECKLIST.md')
