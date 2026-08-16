import subprocess
import os
import sys
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent.parent

def run_git_command(args):
    try:
        result = subprocess.run(["git"] + args, cwd=REPO_DIR, capture_output=True, text=True, check=True)
        print(f"[OK] git {' '.join(args)}\n{result.stdout}")
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        print(f"[ERR] git {' '.join(args)} falló:\n{e.stderr}")
        return False, e.stderr

def main():
    print("=========================================================")
    print(" VINCULANDO PROYECTO LOCAL CON GITHUB REPORTE---1")
    print(" Repositorio: https://github.com/epancajima-bot/REPORTE---1")
    print("=========================================================\n")

    # 1. Verificar estado de git
    ok, out = run_git_command(["status", "--porcelain"])
    if not ok:
        print("Error al verificar el estado del repositorio Git.")
        sys.exit(1)

    # 2. Agregar archivos
    print("--> Añadiendo archivos actualizados de docs/...")
    run_git_command(["add", "docs/"])

    # 3. Commit
    commit_msg = "Sincronizacion de portales HTML con Base de Datos Viva de Google Sheets"
    print(f"--> Creando commit: '{commit_msg}'...")
    run_git_command(["commit", "-m", commit_msg])

    # 4. Push a GitHub
    print("--> Empujando cambios a GitHub (git push)...")
    ok_push, push_out = run_git_command(["push", "origin", "main"])
    if not ok_push:
        print("Intentando push a la rama 'master'...")
        ok_push, push_out = run_git_command(["push", "origin", "master"])

    if ok_push:
        print("\n=========================================================")
        print(" [ÉXITO] ARCHIVOS HTML Y JS PUBLICADOS EN GITHUB PAGES")
        print(" Sitio activo: https://epancajima-bot.github.io/REPORTE---1/")
        print("=========================================================")
    else:
        print("\n[AVISO] No se pudo hacer git push automático. Revisa credenciales o ejecuta 'git push' manualmente.")

if __name__ == "__main__":
    main()
