#!/usr/bin/python3
"""Consistent SQLite snapshot; no credentials or household data in Git."""
import os
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
os.umask(0o077)
base = Path.home() / '.local/share/futter'
source = base / 'app/data/futter.sqlite'
destination = base / 'backups'
destination.mkdir(mode=0o700, parents=True, exist_ok=True)
name = destination / ('futter-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite')
with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as src:
    with sqlite3.connect(name) as target:
        src.backup(target)
        assert target.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
print('Futter backup created and integrity checked.')
