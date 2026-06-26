import json
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

log_path = r"C:\Users\lenovo\.gemini\antigravity\brain\c14c3234-ca87-4be3-8dab-1b7ebded849b\.system_generated\logs\transcript.jsonl"

print("Searching previous conversation logs for outputs at lines 156, 160, 164...")
lines_to_check = [156, 160, 164]

try:
    with open(log_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            if line_num in lines_to_check:
                data = json.loads(line)
                print(f"\n[Line {line_num}] Type: {data.get('type')} | Source: {data.get('source')}")
                content = data.get("content", "")
                # طباعة أول 1000 حرف من المخرجات لمعرفة مسار جافا أو الأخطاء إن وجدت
                print("Content Preview:", content[:1000] + "..." if len(content) > 1000 else content)
except Exception as e:
    print("Error:", e)
