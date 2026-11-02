#!/usr/bin/env python3
"""One-time setup of the guru Worker's database on Cloudflare: the D1 database and its one table, `answer`.
No Node, no wrangler, stdlib only. Safe to run again (and after adding a teacher in agents/): it reuses what exists and adds missing columns.

    python3 tools/setup_db.py           create/find the D1 database, make table answer (writes worker/guru-db.json)
    python3 tools/deploy_worker.py      then upload the Worker (it binds the database as DB)

Table answer: one row per question (its key, see key() below), one column per teacher holding that teacher's answer,
NULL until that teacher has been asked. Table questions: each question exactly as typed -> the answer row it uses
("apa itu surga?" and "Apa itu surga!" both point at the row of "apa itu surga"). The API token in .env needs Account > D1 > Edit.
"""
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_worker import ROOT, load_env, read_config, personas  # noqa: E402

BASE = os.environ.get("CLOUDFLARE_API_BASE", "https://api.cloudflare.com/client/v4")


def api(method, path, token, body=None):
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


def key(question):
    """The same normalisation as key() in worker/guru.js: lower case, single spaces, no punctuation at either end."""
    spaced = re.sub(r"\s+", " ", question.lower()).strip()
    k = re.sub(r"^[\s¡¿\"'“”‘’(]+|[\s?!.。,;:…\"'“”‘’)]+$", "", spaced)
    return re.sub(r"\s+([?!.,])", r"\1", k) or spaced  # a question of punctuation only ("???") keeps it


def slugify(question):
    """The same slug as slugify() in worker/guru.js: the words in lower case joined with '-', at most 60 characters."""
    s = "".join(c for c in unicodedata.normalize("NFKD", question) if not unicodedata.combining(c)).lower()
    s = "".join(c if c.isalnum() else "-" for c in s)
    return re.sub(r"-+", "-", s).strip("-")[:60].rstrip("-") or "q"


def sql_value(v):
    if v is None:
        return "NULL"
    return str(v) if isinstance(v, int) else "'" + str(v).replace("'", "''") + "'"


def need(payload, what):
    if not payload.get("success"):
        errors = "; ".join(e.get("message", "?") for e in payload.get("errors", []))
        hint = "\n  -> the token is missing a permission: add Account > D1 > Edit in Cloudflare > My Profile > API Tokens" if "uthentication" in errors else ""
        sys.exit(f"{what} failed: {errors}{hint}")
    return payload["result"]


def database(account, token, name):
    found = need(api("GET", f"/accounts/{account}/d1/database?name={name}", token), "Listing D1 databases")
    for db in found:
        if db["name"] == name:
            print(f"D1 database '{name}' exists ({db['uuid'][:8]}...)")
            return db["uuid"]
    created = need(api("POST", f"/accounts/{account}/d1/database", token, {"name": name}), "Creating the D1 database")
    print(f"Created D1 database '{name}' ({created['uuid'][:8]}...)")
    return created["uuid"]


def query(account, token, db_id, sql, what):
    return need(api("POST", f"/accounts/{account}/d1/database/{db_id}/query", token, {"sql": sql}), what)


def main():
    load_env()
    token, account = os.environ.get("CLOUDFLARE_API_TOKEN"), os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        sys.exit("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env")
    cfg = read_config()
    db_id = database(account, token, cfg["d1"]["name"])
    (ROOT / "worker" / "guru-db.json").write_text(json.dumps({"database_id": db_id}, indent=2) + "\n", encoding="utf-8")
    query(account, token, db_id,
          "CREATE TABLE IF NOT EXISTS answer (question TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT)",
          "Creating table answer")
    have = {c["name"] for c in query(account, token, db_id, "PRAGMA table_info(answer)", "Reading table answer")[0]["results"]}
    if "answerable" in have:  # the first version had one verdict for the whole question; now each teacher has its own
        query(account, token, db_id, "ALTER TABLE answer DROP COLUMN answerable", "Dropping column answerable")
        print("Dropped column answerable")
    if "screener" not in have:  # the screener's answer for a question no tradition can answer
        query(account, token, db_id, "ALTER TABLE answer ADD COLUMN screener TEXT", "Adding column screener")
        print("Added column screener")
    for t in personas():  # one column per teacher; ids are file names (islam, protestant...), checked here so they are safe as column names
        if not t["id"].isidentifier():
            sys.exit(f"teacher id '{t['id']}' cannot be a column name")
        # <id> holds the answer (NULL = not asked yet); <id>_answerable the screener's verdict: 1 = that tradition can answer, 0 = it cannot (SQLite has no boolean);
        # <id>_at when that answer was saved (UTC, like created_at)
        for col, kind in ((t["id"], "TEXT"), (f'{t["id"]}_answerable', "INTEGER"), (f'{t["id"]}_at', "TEXT")):
            if col not in have:
                query(account, token, db_id, f'ALTER TABLE answer ADD COLUMN "{col}" {kind}', f"Adding column {col}")
                print(f"Added column {col}")
    have = {c["name"] for c in query(account, token, db_id, "PRAGMA table_info(answer)", "Reading table answer")[0]["results"]}
    if "id" not in have:
        add_ids(account, token, db_id, [c for c in have if c not in ("question", "created_at", "updated_at")])
    query(account, token, db_id,
          "CREATE TABLE IF NOT EXISTS questions (question TEXT PRIMARY KEY, answer_id INTEGER NOT NULL REFERENCES answer(id), "
          "created_at TEXT NOT NULL DEFAULT (datetime('now')))",
          "Creating table questions")
    have = {c["name"] for c in query(account, token, db_id, "PRAGMA table_info(answer)", "Reading table answer")[0]["results"]}
    if "slug" not in have:  # the address of the question
        query(account, token, db_id, "ALTER TABLE answer ADD COLUMN slug TEXT", "Adding column slug")
        print("Added column slug")
    query(account, token, db_id, "CREATE UNIQUE INDEX IF NOT EXISTS answer_slug ON answer (slug)", "Indexing slug")
    rows = query(account, token, db_id, "SELECT id, question, slug FROM answer ORDER BY created_at, id", "Reading slugs")[0]["results"]
    taken = {r["slug"] for r in rows if r["slug"]}
    for r in rows:  # a slug for every row that has none yet; the same words with other letters get -2, -3 ...
        if r["slug"]:
            continue
        base, slug, n = slugify(r["question"]), None, 1
        while slug is None or slug in taken:
            slug = base if n == 1 else f"{base}-{n}"
            n += 1
        taken.add(slug)
        need(api("POST", f"/accounts/{account}/d1/database/{db_id}/query", token, {"sql": "UPDATE answer SET slug = ?1 WHERE id = ?2", "params": [slug, r["id"]]}), "Saving a slug")
        print(f"Slug {slug}")
    print("Tables answer and questions ready.")
    print("Next:  python3 tools/deploy_worker.py")


def add_ids(account, token, db_id, cols):
    """The first version keyed answer on the question only. SQLite cannot add a primary key, so the table is rebuilt with an id:
    old keys that now share a key() are merged (the newest row wins, its empty columns filled from the older rows), and each old
    key goes to table questions, pointing at its row."""
    rows = query(account, token, db_id, "SELECT * FROM answer ORDER BY updated_at DESC", "Reading table answer")[0]["results"]
    merged = {}
    for r in rows:
        m = merged.setdefault(key(r["question"]), {"question": key(r["question"]), "old": []})
        m["old"].append(r["question"])
        m["created_at"] = r["created_at"]  # the oldest, as rows come newest first
        for c in ("updated_at", *cols):
            if m.get(c) is None:
                m[c] = r[c]
    kinds = {c["name"]: c["type"] for c in query(account, token, db_id, "PRAGMA table_info(answer)", "Reading table answer")[0]["results"]}
    sql = ["CREATE TABLE answer_new (id INTEGER PRIMARY KEY, question TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')), "
           "updated_at TEXT, " + ", ".join(f'"{c}" {kinds[c]}' for c in cols) + ")"]
    quoted = ", ".join(f'"{c}"' for c in cols)
    for i, m in enumerate(merged.values(), 1):
        sql.append(f'INSERT INTO answer_new (id, question, created_at, updated_at, {quoted}) VALUES '
                   f'({i}, {", ".join(sql_value(m[c]) for c in ("question", "created_at", "updated_at", *cols))})')
    # table questions is made after the rename, so its reference is to the new table answer
    sql += ["DROP TABLE answer", "ALTER TABLE answer_new RENAME TO answer",
            "CREATE TABLE questions (question TEXT PRIMARY KEY, answer_id INTEGER NOT NULL REFERENCES answer(id), created_at TEXT NOT NULL DEFAULT (datetime('now')))"]
    for i, m in enumerate(merged.values(), 1):
        sql += [f"INSERT INTO questions (question, answer_id) VALUES ({sql_value(q)}, {i})" for q in m["old"]]
    query(account, token, db_id, ";\n".join(sql), "Adding column id to table answer")
    print(f"Added column id: {len(rows)} rows -> {len(merged)}, old questions kept in table questions")


if __name__ == "__main__":
    main()
