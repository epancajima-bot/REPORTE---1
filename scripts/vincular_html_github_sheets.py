# -*- coding: utf-8 -*-
"""
SCRIPT DE VINCULACIÓN: HTML de GitHub Pages <-> Google Sheets (Apps Script)

Qué hace:
  1) Configura la URL del Google Apps Script (endpoint web-app) en TODOS los
     portales HTML (window.RO_API_ENDPOINT inline) y en assets/app.js (fallback global).
  2) Audita portal por portal y reporta CONFORME / REQUIERE AJUSTE.
  3) (Opcional con --push) ejecuta git add, commit y push para publicar en GitHub Pages.

Uso:
  python scripts/vincular_html_github_sheets.py                        # usa la URL activa ya configurada
  python scripts/vincular_html_github_sheets.py --url "https://script.google.com/macros/s/XXXX/exec"
  python scripts/vincular_html_github_sheets.py --push --message "Vinculado a Google Sheets v2"
  python scripts/vincular_html_github_sheets.py --no-commit            # solo actualiza y audita
  python scripts/vincular_html_github_sheets.py --check-live           # además verifica el sitio publicado
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_FILE = ROOT / "scripts" / "vinculacion_config.json"
APP_JS = ROOT / "assets" / "app.js"
SCRIPT_TAG = '<script src="assets/app.js"></script>'
ENDPOINT_KEY = "window.RO_API_ENDPOINT"
DEFAULT_REMOTE = "https://github.com/epancajima-bot/REPORTE---1.git"
GHPAGES_ROOT = "https://epancajima-bot.github.io/REPORTE---1/"

URL_RE = re.compile(r"https://script\.google\.com/macros/s/[A-Za-z0-9_\-/]+/(?:exec|dev)")
# La URL ACTIVA es la del fallback "|| '.../exec'" en app.js (no las URLs rotas históricas).
ACTIVE_URL_RE = re.compile(r"\|\|\s*['\"](https://script\.google\.com/macros/s/[A-Za-z0-9_\-/]+/(?:exec|dev))['\"]")
ENDPOINT_INLINE_RE = re.compile(
    r"(window\.RO_API_ENDPOINT\s*=\s*[\"'])([^\"']+?)([\"'])"
)


def load_config():
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_config(cfg):
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")


def portal_files():
    """HTML de la raíz del repo que cargan assets/app.js (los portales activos)."""
    files = []
    for html in sorted(ROOT.glob("*.html")):
        if "assets/app.js" in html.read_text(encoding="utf-8"):
            files.append(html)
    return files


def get_active_endpoint(args):
    cfg = load_config()
    if args.url:
        return args.url.rstrip("/")
    if cfg.get("endpoint_url"):
        return cfg["endpoint_url"]
    if APP_JS.exists():
        text = APP_JS.read_text(encoding="utf-8")
        match = ACTIVE_URL_RE.search(text)
        if match:
            return match.group(1)
        match = URL_RE.search(text)
        if match:
            return match.group(0)
    sys.exit("ERROR: No se encontró ninguna URL activa. Usa --url para indicarla.")


def update_html(html_path, url, dry_run=False):
    text = html_path.read_text(encoding="utf-8")
    inline = f'<script>{ENDPOINT_KEY} = "{url}";</script>'
    if f"{ENDPOINT_KEY} =" not in text:
        if SCRIPT_TAG not in text:
            return False, "No carga assets/app.js; no se inserta config."
        new_text = text.replace(SCRIPT_TAG, inline + "\n        " + SCRIPT_TAG)
        if not dry_run:
            html_path.write_text(new_text, encoding="utf-8")
        return True, "Config inline faltante (se insertaría)."
    new_text, n = ENDPOINT_INLINE_RE.subn(lambda m: f"{m.group(1)}{url}{m.group(3)}", text, count=1)
    if n == 0:
        return False, "window.RO_API_ENDPOINT presente pero no se pudo actualizar."
    if new_text == text:
        return True, "URL inline ya configurada."
    if not dry_run:
        html_path.write_text(new_text, encoding="utf-8")
    return True, "URL inline " + ("se actualizaría." if dry_run else "actualizada.")


def update_app_js(url, dry_run=False):
    text = APP_JS.read_text(encoding="utf-8")
    found = URL_RE.findall(text)
    new_text = text
    for old in set(found):
        new_text = new_text.replace(old, url)
    new_text = new_text.replace(f"        '{url}',\n", "")
    if not dry_run and new_text != text:
        APP_JS.write_text(new_text, encoding="utf-8")
    return len(set(found))


def update_docs(url, dry_run=False):
    updated = []
    for doc in [ROOT / "GUIA_VINCULACION_GOOGLE_SHEETS_GITHUB_PAGES.md", ROOT / "README.md"]:
        if not doc.exists():
            continue
        text = doc.read_text(encoding="utf-8")
        new_text = URL_RE.sub(lambda m: url, text)
        if new_text != text:
            if not dry_run:
                doc.write_text(new_text, encoding="utf-8")
            updated.append(doc.name)
    return updated


def audit(portals, url):
    print("\n=== AUDITORÍA DE CABLEADO HTML <-> GOOGLE SHEETS ===")
    app_js_text = APP_JS.read_text(encoding="utf-8")
    all_ok = True
    for html in portals:
        text = html.read_text(encoding="utf-8")
        ok_script = SCRIPT_TAG in text
        ok_endpoint = (ENDPOINT_KEY in text and url in text) or url in app_js_text
        ok = ok_script and ok_endpoint
        all_ok = all_ok and ok
        estado = "CONFORME" if ok else "REQUIERE AJUSTE"
        print(f"  [{estado:>16}] {html.name}  (app.js: {'SÍ' if ok_script else 'NO'} | "
              f"endpoint: {'SÍ' if ok_endpoint else 'NO'})")
    msg = "TODOS LOS PORTALES CABLEADOS OK" if all_ok else "HAY PORTALES SIN CABLEAR"
    print(f"\nResultado global ({len(portals)} portales): {msg}")
    return all_ok


def check_live(portals):
    import urllib.request
    print("\n=== VERIFICACIÓN EN SITIO PUBLICADO ===")
    base = GHPAGES_ROOT
    ok_all = True
    for html in portals:
        url = base + html.name
        try:
            with urllib.request.urlopen(url, timeout=15) as resp:
                body = resp.read().decode("utf-8", "ignore")
            ok = "assets/app.js" in body
            ok_all = ok_all and ok
            print(f"  [{'OK' if ok else 'FALLO'}] {url}")
        except Exception as e:
            ok_all = False
            print(f"  [FALLO] {url} -> {e}")
    return ok_all


def git_run(args, cwd):
    try:
        result = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
        return result.returncode == 0, (result.stdout or result.stderr).strip()
    except FileNotFoundError:
        return False, "git no está disponible en PATH."


def main():
    parser = argparse.ArgumentParser(description="Vincula los portales HTML con Google Sheets y publica en GitHub Pages.")
    parser.add_argument("--url", help="URL del web-app de Google Apps Script (https://script.google.com/macros/s/.../exec)")
    parser.add_argument("--push", action="store_true", help="Ejecuta git push a GitHub Pages tras el commit.")
    parser.add_argument("--no-commit", action="store_true", help="Actualiza y audita sin ejecutar git add/commit.")
    parser.add_argument("--no-docs", action="store_true", help="No actualizar la URL en la guía/README.")
    parser.add_argument("--dry-run", action="store_true", help="Solo auditar y mostrar qué se cambiaría, sin escribir archivos ni git.")
    parser.add_argument("--message", default="Vinculación de portales HTML con Google Sheets", help="Mensaje del commit.")
    parser.add_argument("--check-live", action="store_true", help="Verificar el sitio ya publicado (requiere internet).")
    args = parser.parse_args()

    url = get_active_endpoint(args)
    print("================================================================")
    print(" VINCULACIÓN HTML (GitHub Pages) <-> GOOGLE SHEETS")
    print(f" Repositorio : {DEFAULT_REMOTE}")
    print(f" Sitio       : {GHPAGES_ROOT}")
    print(f" Endpoint    : {url}")
    print("================================================================")

    portals = portal_files()
    if not portals:
        sys.exit("ERROR: No se encontraron portales HTML que carguen assets/app.js.")

    changed_html = 0
    print("\n=== ACTUALIZACIÓN DE PORTALES ===")
    for html in portals:
        ok, msg = update_html(html, url, dry_run=args.dry_run)
        changed_html += 1 if ok else 0
        accion = "OK" if ok else "AJUSTE"
        print(f"  [{accion}] {html.name}: {msg}")

    places = update_app_js(url, dry_run=args.dry_run)
    print(f"  [OK] assets/app.js: URL presente en {places} puntos (fallback global).")

    doc_changes = [] if args.no_docs else update_docs(url, dry_run=args.dry_run)
    if doc_changes:
        print(f"  [OK] Documentación {len(doc_changes)} archivo(s): {', '.join(doc_changes)}")

    audit(portals, url)

    if args.dry_run:
        print("\n[DRY-RUN] No se escribió ningún archivo ni se ejecutó git. Ejecuta sin --dry-run para aplicar.")
        return

    # Persistir la URL activa para futuras ejecuciones.
    cfg = load_config()
    cfg["endpoint_url"] = url
    cfg["github_pages_root"] = GHPAGES_ROOT
    save_config(cfg)

    if args.check_live:
        check_live(portals)

    if args.no_commit:
        print("\n[INFO] Modo --no-commit: no se ejecutó git. Revisa git status para publicar manualmente.")
        return

    print("\n=== PUBLICACIÓN EN GITHUB PAGES ===")
    ok, out = git_run(["status", "--porcelain"], ROOT)
    print(f"  git status ->\n{out or '(working tree limpio)'}")

    files = ["assets/app.js"] + [p.name for p in portals]
    if not args.no_docs:
        files += ["GUIA_VINCULACION_GOOGLE_SHEETS_GITHUB_PAGES.md", "README.md"]
    files.append(str(CONFIG_FILE.relative_to(ROOT)))

    ok, out = git_run(["add", "--"] + files, ROOT)
    if not ok or not git_run(["diff", "--cached", "--quiet"], ROOT)[0]:
        print("  [OK] Cambios listos para commit.")
    else:
        print("  [INFO] No hay cambios que publicar.")

    ok, out = git_run(["commit", "-m", args.message], ROOT)
    print(f"  commit -> {out}")

    if args.push:
        ok, out = git_run(["push", "origin", "HEAD"], ROOT)
        if not ok:
            ok, out = git_run(["push", "origin", "main"], ROOT)
        print(f"  push -> {out}")
        if ok:
            print(f"\n[ÉXITO] Portal actualizado en vivo: {GHPAGES_ROOT}")
        else:
            print("\n[AVISO] No se pudo hacer push. Revisa las credenciales de GitHub.")
    else:
        print("\n[INFO] Para publicar en vivo ejecuta: git push")


if __name__ == "__main__":
    main()