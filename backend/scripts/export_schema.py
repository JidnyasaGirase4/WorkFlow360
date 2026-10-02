"""Generate database/schema.sql (MySQL DDL) straight from the SQLAlchemy models.

    python scripts/export_schema.py

The file can be pasted into phpMyAdmin > SQL to create every table by hand.
"""
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy.dialects import mysql  # noqa: E402
from sqlalchemy.schema import AddConstraint, CreateIndex, CreateTable, ForeignKeyConstraint  # noqa: E402

import app.models  # noqa: E402,F401
from app.database.base import Base  # noqa: E402


def main() -> None:
    dialect = mysql.dialect()
    parts = [
        "-- WorkFlow360 database schema (MySQL / MariaDB, XAMPP compatible)",
        f"-- Generated from the SQLAlchemy models on {date.today().isoformat()} by scripts/export_schema.py. Do not edit by hand.",
        "",
        "-- Select the (empty) workflow360_db database in phpMyAdmin first, then import / run this file.",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "",
    ]
    fk_later: list[str] = []
    for table in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table).compile(dialect=dialect)).strip()
        ddl = ddl.replace("\n)\n", "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci\n") if ") ENGINE" not in ddl else ddl
        parts.append(ddl + ";\n")
        for index in sorted(table.indexes, key=lambda i: i.name or ""):
            parts.append(str(CreateIndex(index).compile(dialect=dialect)).strip() + ";")
        parts.append("")
        # foreign keys that close a dependency cycle (users <-> clients, invoices <-> quotations) are added afterwards
        fk_later += [
            str(AddConstraint(c).compile(dialect=dialect)).strip() + ";"
            for c in table.constraints
            if isinstance(c, ForeignKeyConstraint) and c.use_alter
        ]
    parts += fk_later
    parts.append("SET FOREIGN_KEY_CHECKS = 1;")
    out = ROOT / "sql" / "schema.sql"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(parts) + "\n", encoding="utf-8")
    print(f"Wrote {out} ({len(Base.metadata.tables)} tables)")


if __name__ == "__main__":
    main()

