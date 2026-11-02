#!/usr/bin/env python3
"""One-time setup of the guru Worker's database on Cloudflare: the D1 database and its one table, `answer`.
No Node, no wrangler, stdlib only. Safe to run again (and after adding a teacher in agents/): it reuses what exists and adds missing columns.

    python3 tools/setup_db.py           create/find the D1 database, make table answer (writes worker/guru-db.json)
    python3 tools/deploy_worker.py      then upload the Worker (it binds the database as DB)

Table answer: one row per question (normalised: lower case, single spaces), one column per teacher holding that teacher's answer,
NULL until that teacher has been asked. The API token in .env needs Account > D1 > Edit.
"""
import json
import os
import sys
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
        # <id> holds the answer (NULL = not asked yet); <id>_answerable the screener's verdict: 1 = that tradition can answer, 0 = it cannot (SQLite has no boolean)
        for col, kind in ((t["id"], "TEXT"), (f'{t["id"]}_answerable', "INTEGER")):
            if col not in have:
                query(account, token, db_id, f'ALTER TABLE answer ADD COLUMN "{col}" {kind}', f"Adding column {col}")
                print(f"Added column {col}")
    print("Table answer ready.")
    print("Next:  python3 tools/deploy_worker.py")


if __name__ == "__main__":
    main()
