"""Generate API documentation artefacts from the running app definition.

    python scripts/export_docs.py

Writes:
  docs/API_ENDPOINTS.md                       endpoint reference grouped by module (with required permissions)
  postman/WorkFlow360.postman_collection.json Postman collection (login stores the token automatically)
"""
import importlib
import json
import pkgutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.routing import APIRoute  # noqa: E402

from app import routers as routers_package  # noqa: E402
from app.main import app  # noqa: E402


def required_permissions(route: APIRoute) -> list[str]:
    found: list[str] = []

    def walk(dependant) -> None:
        for dep in dependant.dependencies:
            found.extend(getattr(dep.call, "required_permissions", ()))
            walk(dep)

    walk(route.dependant)
    return found


def is_public(route: APIRoute) -> bool:
    return not any(getattr(dep.call, "__name__", "") == "get_ctx" or "get_ctx" in str(dep.call) for dep in _flatten(route.dependant))


def _flatten(dependant):
    for dep in dependant.dependencies:
        yield dep
        yield from _flatten(dep)


def _api_routes():
    """Every APIRoute of every router module (same discovery as app.main), independent of FastAPI internals."""
    for module_info in pkgutil.iter_modules(routers_package.__path__):
        module = importlib.import_module(f"{routers_package.__name__}.{module_info.name}")
        routers = ([module.router] if hasattr(module, "router") else []) + list(getattr(module, "extra_routers", []))
        for router in routers:
            for route in router.routes:
                if isinstance(route, APIRoute):
                    yield route


def collect() -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for route in _api_routes():
        for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
            grouped.setdefault((route.tags or ["Other"])[0], []).append({
                "method": method,
                "path": "/api/v1" + route.path,
                "summary": route.summary or route.name.replace("_", " ").title(),
                "description": (route.description or "").strip(),
                "permissions": required_permissions(route),
                "public": is_public(route),
                "route": route,
            })
    return dict(sorted(grouped.items()))


def write_markdown(grouped: dict[str, list[dict]]) -> Path:
    total = sum(len(v) for v in grouped.values())
    lines = [
        "# WorkFlow360 API endpoint reference", "",
        f"Base URL: `http://localhost:8000/api/v1` — **{total} endpoints**. Interactive docs: `/docs` (Swagger) and `/redoc`.", "",
        "Send `Authorization: Bearer <access_token>` on every endpoint except those marked *public*. "
        "\"Permission\" is the permission code the caller's role must hold (in addition to company/row-level checks described in the endpoint's Swagger description). "
        "Endpoints with no permission code only require a valid login and apply their own row-level rules.", "",
    ]
    for tag, items in grouped.items():
        lines += [f"## {tag}", "", "| Method | Path | Summary | Access |", "|---|---|---|---|"]
        for it in sorted(items, key=lambda i: (i["path"], i["method"])):
            access = "public" if it["public"] else (", ".join(f"`{p}`" for p in it["permissions"]) or "any signed-in user")
            lines.append(f"| {it['method']} | `{it['path']}` | {it['summary']} | {access} |")
        lines.append("")
    out = ROOT / "docs" / "API_ENDPOINTS.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    return out


def _postman_item(it: dict, schema: dict) -> dict:
    op = schema["paths"].get(it["path"], {}).get(it["method"].lower(), {})
    url_path = it["path"].replace("/api/v1", "")
    segments = [s for s in url_path.strip("/").split("/") if s]
    variables = [{"key": s[1:-1], "value": "1"} for s in segments if s.startswith("{")]
    query = [
        {"key": p["name"], "value": "", "disabled": True}
        for p in op.get("parameters", []) if p.get("in") == "query"
    ]
    request: dict = {
        "method": it["method"],
        "header": [],
        "url": {
            "raw": "{{base_url}}" + url_path + ("?" + "&".join(q["key"] + "=" for q in query) if query else ""),
            "host": ["{{base_url}}"],
            "path": [(":" + s[1:-1]) if s.startswith("{") else s for s in segments],
            "query": query,
            "variable": variables,
        },
        "description": it["description"] or it["summary"],
    }
    if not it["public"]:
        request["auth"] = {"type": "bearer", "bearer": [{"key": "token", "value": "{{access_token}}", "type": "string"}]}
    content = op.get("requestBody", {}).get("content", {})
    if "application/json" in content:
        request["header"].append({"key": "Content-Type", "value": "application/json"})
        request["body"] = {"mode": "raw", "raw": json.dumps(_example(content["application/json"]["schema"], schema), indent=2), "options": {"raw": {"language": "json"}}}
    elif "multipart/form-data" in content:
        request["body"] = {"mode": "formdata", "formdata": [{"key": "file", "type": "file"}]}
    item = {"name": f"{it['method']} {url_path}  —  {it['summary']}", "request": request}
    if url_path == "/auth/login":
        item["event"] = [{"listen": "test", "script": {"type": "text/javascript", "exec": [
            "const res = pm.response.json();",
            "if (res.data && res.data.access_token) {",
            "  pm.collectionVariables.set('access_token', res.data.access_token);",
            "  pm.collectionVariables.set('refresh_token', res.data.refresh_token);",
            "}",
        ]}}]
    return item


def _example(sch: dict, root: dict, depth: int = 0):
    """Tiny JSON-schema -> example value generator (enough for request bodies)."""
    if "$ref" in sch:
        return _example(root["components"]["schemas"][sch["$ref"].split("/")[-1]], root, depth + 1)
    if "anyOf" in sch:
        options = [o for o in sch["anyOf"] if o.get("type") != "null"]
        return _example(options[0], root, depth + 1) if options else None
    if "allOf" in sch:
        return _example(sch["allOf"][0], root, depth + 1)
    if "enum" in sch:
        return sch["enum"][0]
    kind = sch.get("type")
    if kind == "object":
        if depth > 4:
            return {}
        props = sch.get("properties", {})
        required = set(sch.get("required", []))
        return {k: _example(v, root, depth + 1) for k, v in props.items() if k in required}
    if kind == "array":
        return [_example(sch.get("items", {}), root, depth + 1)] if depth < 3 else []
    if kind == "integer":
        return 1
    if kind == "number":
        return 1000
    if kind == "boolean":
        return True
    fmt = sch.get("format")
    return {"email": "user@workflow360.local", "date": "2026-01-31", "date-time": "2026-01-31T10:00:00", "time": "10:00:00"}.get(fmt, "string")


def write_postman(grouped: dict[str, list[dict]]) -> Path:
    schema = app.openapi()
    collection = {
        "info": {"name": "WorkFlow360 API", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
                 "description": "Run **Auth / POST /auth/login** first — it stores the access token in the collection variable used by every other request."},
        "variable": [{"key": "base_url", "value": "http://localhost:8000/api/v1"}, {"key": "access_token", "value": ""}, {"key": "refresh_token", "value": ""}],
        "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{access_token}}", "type": "string"}]},
        "item": [{"name": tag, "item": [_postman_item(it, schema) for it in sorted(items, key=lambda i: (i["path"], i["method"]))]} for tag, items in grouped.items()],
    }
    out = ROOT / "postman" / "WorkFlow360.postman_collection.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(collection, indent=2), encoding="utf-8")
    return out


if __name__ == "__main__":
    data = collect()
    print("Wrote", write_markdown(data))
    print("Wrote", write_postman(data))
