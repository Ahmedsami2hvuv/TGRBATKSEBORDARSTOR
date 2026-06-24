import subprocess
import sys

repo_path = r"C:\Users\lenovo\Documents\GitHub\TGRBATKSEBORDARSTOR"

def run_git(args):
    cmd = ["git"] + args
    print(f"Running command: {' '.join(cmd)}")
    try:
        res = subprocess.run(
            cmd,
            cwd=repo_path,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        print("STDOUT:")
        print(res.stdout)
        if res.stderr:
            print("STDERR:")
            print(res.stderr)
        print(f"Exit code: {res.returncode}\n")
        return res.returncode == 0
    except Exception as e:
        print(f"Exception: {e}\n")
        return False

print("=== Starting Git Python Script ===")
if run_git(["status"]):
    if run_git(["add", "."]):
        if run_git(["commit", "-m", "اصلاح نظام التنبيه القوي وتحديث روابط السيرفر في التطبيقات الويب وأندرويد وبنائها بنجاح"]):
            run_git(["push"])
print("=== Finished Git Python Script ===")
