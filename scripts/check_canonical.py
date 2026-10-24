#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
canonical_root = root / 'CANONICAL.md'
archive_readme = root / 'archive' / 'README.md'
archive_legacy = root / 'archive' / 'legacy' / 'README.md'

allowed = {
    'README.md', 'CANONICAL.md', 'archive', '.github', '.well-known',
    '.nojekyll', 'CNAME', 'llms.txt', 'openapi.json', 'robots.txt',
    'sitemap.xml', 'smithery.yaml', 'index.html', 'essay.html',
    'protocol.html', 'success.html', 'beacon.html', 'action.yml',
    'assets', 'attestations', 'benchmarks', 'contracts', 'docs', 'examples',
    'p', 'packages', 'py', 'ts', 'AGENTKIT.md', 'BEACON.md',
    'CIRCUIT_BREAKER.md', 'CI_CD.md', 'DIS_BENCHMARK.md', 'ESCROW.md',
    '.gitignore', '.git', '1-From_Assertion_to_Authority_Mata_v_Avianca_Proof_Dossier_v2.docx',
    '1-adversarial-memorandum.pdf', '1-before-certainty-excerpt.pdf', '1-coherent-substitution.pdf',
    '1-elemental-properties-excerpt.pdf', '1-jurisdiction-across-time-preprint.pdf',
    '1-keeping-room-chalk-dust-portraiture.pdf', '1-room-without-a-view-excerpt.pdf',
    '1-silhouette-fallacy-excerpt.pdf', '2-style.css', '3-author.jpg', '4-before-certainty.jpg',
    '5-elemental-properties-of-true.jpg', '6-room-without-a-view.jpg', '7-silhouette-fallacy.jpg'
}

violations = []
for child in sorted(root.iterdir()):
    if child.name not in allowed and not child.name.startswith('.'):
        if child.is_dir() and child.name != 'archive':
            violations.append(f'directory:{child.name}')
        elif child.is_file():
            violations.append(f'file:{child.name}')

if not canonical_root.exists():
    violations.append('missing:CANONICAL.md')
if not archive_readme.exists():
    violations.append('missing:archive/README.md')
if not archive_legacy.exists():
    violations.append('missing:archive/legacy/README.md')

if violations:
    print('Canonical boundary violation detected:')
    for v in violations:
        print(f' - {v}')
    print('\nOnly the canonical machine may sit at the repo root. Archive non-authoritative material under archive/.')
    sys.exit(1)

print('Canonical boundary OK.')
