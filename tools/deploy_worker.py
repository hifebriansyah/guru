#!/usr/bin/env python3
"""Upload the guru Worker to Cloudflare. No Node, no wrangler, stdlib only.

    python3 tools/deploy_worker.py

Reads worker/guru.jsonc and worker/guru.js, puts the teachers from agents/*.md (and the screener, agents/screener.md) into the code, uploads it, attaches
guru-worker.situs.id and turns the workers.dev address off. Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, from .env
here, ../.env or ../chat-learning/.env (the values are never printed). AXIOM_TOKEN (the request log) is copied to the Worker from
the same files. GEMINI_API_KEY is entered in the Cloudflare dashboard; deploys keep it.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCREENER_FILE = "screener.md"  # in agents/, but it sorts the questions instead of answering them
BASE = os.environ.get("CLOUDFLARE_API_BASE", "https://api.cloudflare.com/client/v4")


def load_env():
    for f in (ROOT / ".env", ROOT.parent / ".env", ROOT.parent / "chat-learning" / ".env"):  # the first file that has a value wins
        if f.exists():
            for line in f.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def read_config():
    # the .jsonc file only has whole-line // comments, so this is enough.
    text = (ROOT / "worker" / "guru.jsonc").read_text(encoding="utf-8")
    return json.loads("\n".join(l for l in text.splitlines() if not l.strip().startswith("//")))


def personas():
    """agents/<id>.md -> {id, title, tradition, prompt}. The first line is '# <Title>: <Tradition> master'."""
    out = []
    for f in sorted((ROOT / "agents").glob("*.md")):
        if f.name == SCREENER_FILE:  # the screener is not a teacher
            continue
        text = f.read_text(encoding="utf-8").strip()
        m = re.match(r"#\s*(.+?):\s*(.+?)\s+master\s*$", text.splitlines()[0])
        if not m:
            sys.exit(f"{f.name}: the first line must be '# <Title>: <Tradition> master'")
        out.append({"id": f.stem, "title": m[1].strip(), "tradition": m[2].strip(), "prompt": text})
    if not out:
        sys.exit("no teachers in agents/")
    return out


def call(token, method, path, body=None):
    req = urllib.request.Request(
        f"{BASE}{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "guru-deploy/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"success": False, "errors": [{"message": f"HTTP {e.code}"}]}


def main():
    load_env()
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        sys.exit("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env")
    cfg = read_config()
    teachers = personas()
    code = (ROOT / "worker" / cfg["main"]).read_text(encoding="utf-8")
    if "__PERSONAS__" not in code:
        sys.exit("worker code has no __PERSONAS__ placeholder")
    code = code.replace("__PERSONAS__", json.dumps(teachers, ensure_ascii=False), 1)
    if "__SCREENER__" not in code:
        sys.exit("worker code has no __SCREENER__ placeholder")
    code = code.replace("__SCREENER__", json.dumps((ROOT / "agents" / SCREENER_FILE).read_text(encoding="utf-8").strip(), ensure_ascii=False), 1)

    bindings = [{"type": "ratelimit", "name": r["name"], "namespace_id": r["namespace_id"], "simple": r["simple"]} for r in cfg.get("ratelimits", [])]
    if cfg.get("d1"):
        db_file = ROOT / "worker" / "guru-db.json"
        if not db_file.exists():
            sys.exit("worker/guru-db.json is missing: run  python3 tools/setup_db.py  first")
        bindings.append({"type": "d1", "name": cfg["d1"]["binding"], "id": json.loads(db_file.read_text())["database_id"]})
    bindings += [{"type": "plain_text", "name": k, "text": v} for k, v in cfg.get("vars", {}).items()]
    metadata = {"main_module": cfg["main"], "compatibility_date": cfg["compatibility_date"], "bindings": bindings,
                "keep_bindings": ["secret_text"]}  # GEMINI_API_KEY stays across deploys
    if cfg.get("placement"):
        metadata["placement"] = cfg["placement"]

    boundary = uuid.uuid4().hex
    body = b""
    for name, filename, ctype, content in (("metadata", None, "application/json", json.dumps(metadata)),
                                           (cfg["main"], cfg["main"], "application/javascript+module", code)):
        disp = f'form-data; name="{name}"' + (f'; filename="{filename}"' if filename else "")
        body += f"--{boundary}\r\nContent-Disposition: {disp}\r\nContent-Type: {ctype}\r\n\r\n{content}\r\n".encode("utf-8")
    body += f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{BASE}/accounts/{account}/workers/scripts/{cfg['name']}", data=body, method="PUT", headers={
        "Authorization": f"Bearer {token}", "Content-Type": f"multipart/form-data; boundary={boundary}",
        "User-Agent": "guru-deploy/1.0",  # Cloudflare blocks the default Python user agent
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            payload = json.loads(res.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"Deploy failed: HTTP {e.code}\n{e.read().decode('utf-8', 'replace')[:500]}")
    if not payload.get("success"):
        sys.exit(f"Deploy failed: {payload.get('errors')}")
    print(f"Deployed worker '{cfg['name']}' ({len(code)} bytes, teachers: {', '.join(t['id'] for t in teachers)}).")
    for name in ("AXIOM_TOKEN",):  # copied from .env, never printed
        value = os.environ.get(name)
        if value:
            res = call(token, "PUT", f"/accounts/{account}/workers/scripts/{cfg['name']}/secrets", {"name": name, "text": value, "type": "secret_text"})
            print(f"Secret {name} {'set' if res.get('success') else 'NOT set'} on the Worker.")

    domain = cfg["domain"]
    zones = call(token, "GET", f"/zones?name={'.'.join(domain.split('.')[-2:])}").get("result") or []
    if zones:
        res = call(token, "PUT", f"/accounts/{account}/workers/domains",
                   {"hostname": domain, "service": cfg["name"], "environment": "production", "zone_id": zones[0]["id"]})
        print(f"Domain https://{domain}/ -> {cfg['name']}" if res.get("success") else f"Domain {domain} NOT attached: {res.get('errors')}")
    else:
        print(f"Domain {domain}: the token cannot read its zone; attach it in the dashboard.")
    off = call(token, "POST", f"/accounts/{account}/workers/scripts/{cfg['name']}/subdomain", {"enabled": False})
    print("workers.dev address off" if off.get("success") else f"workers.dev not changed ({(off.get('errors') or [{}])[0].get('message')})")
    print("GEMINI_API_KEY is a secret you enter in the dashboard (Worker > Settings > Variables and Secrets); deploys keep it.")


if __name__ == "__main__":
    main()
