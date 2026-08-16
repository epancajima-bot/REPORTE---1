import subprocess
import os
from pathlib import Path

cwd = Path(__file__).resolve().parent.parent

def run_cmd(args):
    res = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    print(f"Executing: {' '.join(args)}")
    print(f"STDOUT: {res.stdout.strip()}")
    if res.stderr:
        print(f"STDERR: {res.stderr.strip()}")
    return res.returncode == 0

print("--- Inicializando repositorio Git y vinculando con GitHub ---")
run_cmd(["git", "init"])
run_cmd(["git", "remote", "add", "origin", "https://github.com/epancajima-bot/REPORTE---1.git"])
run_cmd(["git", "remote", "set-url", "origin", "https://github.com/epancajima-bot/REPORTE---1.git"])
run_cmd(["git", "add", "docs/"])
run_cmd(["git", "commit", "-m", "Vincular portales HTML con Google Sheets Web App API"])
run_cmd(["git", "branch", "-M", "main"])
run_cmd(["git", "push", "-u", "origin", "main"])
