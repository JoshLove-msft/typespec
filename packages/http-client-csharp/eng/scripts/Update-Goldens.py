"""
Transform golden .cs test data files to match the new CodeWriter output that emits
short type names (with using directives) instead of fully-qualified `global::Namespace.Type`.

Algorithm mirrors CodeWriter.ShortenQualifiedNames:
1. Per file, collect every emitted (namespace, headName) pair from `global::Namespace.HeadName...` occurrences in non-XML-doc text.
2. Detect collisions: head names emitted from more than one namespace.
3. Replace each `global::ns.headName` occurrence with either bare `headName` (singleton) or `ns.headName` (collision).
4. Lines starting with `///` are XML doc comments and are left untouched (matches the sentinel approach in CodeWriter).
"""

import os
import re
import sys
from pathlib import Path

USING_RE = re.compile(r'^\s*using\s+(?:static\s+)?([\w.]+)\s*;')
NAMESPACE_RE = re.compile(r'^\s*namespace\s+([\w.]+)')
GLOBAL_RE = re.compile(r'global::([\w.]+)')

def split_lines(text):
    return text.splitlines(keepends=True)

def is_doc_line(line):
    stripped = line.lstrip()
    return stripped.startswith('///')

def collect_namespaces(lines):
    usings = set()
    file_namespace = None
    for line in lines:
        m = USING_RE.match(line)
        if m:
            usings.add(m.group(1))
        m = NAMESPACE_RE.match(line)
        if m and file_namespace is None:
            file_namespace = m.group(1)
    return usings, file_namespace

def parse_global(match_path, known_namespaces):
    """
    Given a path like "A.B.C.D" extracted from `global::A.B.C.D`, find the longest
    namespace prefix that is a known namespace (using or file ns or parent ns).
    Returns (namespace, headName) or None.
    """
    parts = match_path.split('.')
    for i in range(len(parts) - 1, 0, -1):
        ns = '.'.join(parts[:i])
        head = parts[i]
        if ns in known_namespaces:
            return ns, head, parts[i + 1:]
    # Nothing matched a known namespace - leave alone
    return None

def transform_file(path):
    text = path.read_text(encoding='utf-8')
    lines = split_lines(text)
    usings, file_namespace = collect_namespaces(lines)
    known = set(usings)
    if file_namespace:
        known.add(file_namespace)
        # Also add containing namespaces (parent namespace search in C# resolves through ancestors)
        ns_parts = file_namespace.split('.')
        for i in range(1, len(ns_parts)):
            known.add('.'.join(ns_parts[:i]))

    # First pass: collect (namespace, headName) pairs from non-doc lines
    head_to_namespaces = {}
    for line in lines:
        if is_doc_line(line):
            continue
        for m in GLOBAL_RE.finditer(line):
            full_path = m.group(1)
            parsed = parse_global(full_path, known)
            if parsed is None:
                continue
            ns, head, _ = parsed
            head_to_namespaces.setdefault(head, set()).add(ns)

    if not head_to_namespaces:
        return False

    # Build replacement plan: (ns, head) -> replacement
    def rewrite_line(line):
        if is_doc_line(line):
            return line

        def repl(m):
            full_path = m.group(1)
            parsed = parse_global(full_path, known)
            if parsed is None:
                return m.group(0)
            ns, head, rest = parsed
            collided = len(head_to_namespaces.get(head, set())) > 1
            replacement = f'{ns}.{head}' if collided else head
            if rest:
                replacement += '.' + '.'.join(rest)
            return replacement

        return GLOBAL_RE.sub(repl, line)

    new_lines = [rewrite_line(line) for line in lines]
    new_text = ''.join(new_lines)
    if new_text != text:
        path.write_text(new_text, encoding='utf-8', newline='')
        return True
    return False

def main():
    if len(sys.argv) < 2:
        print("Usage: Update-Goldens.py <root-dir>")
        sys.exit(1)

    root = Path(sys.argv[1])
    changed = 0
    total = 0
    for testdata_dir in root.rglob('TestData'):
        if not testdata_dir.is_dir():
            continue
        for cs_file in testdata_dir.rglob('*.cs'):
            total += 1
            try:
                if transform_file(cs_file):
                    changed += 1
            except Exception as e:
                print(f'ERROR: {cs_file}: {e}')
    print(f'Processed {total} files, modified {changed}')

if __name__ == '__main__':
    main()
