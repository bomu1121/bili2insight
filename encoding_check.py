# encoding_check.py - verify all project files are UTF-8
import os, sys

SRC_DIRS = ["src", "worker"]
EXTENSIONS = (".vue", ".ts", ".js", ".css", ".py", ".rs", ".json", ".toml")
BAD = []

for dirname in SRC_DIRS:
    if not os.path.isdir(dirname):
        continue
    for root, _, files in os.walk(dirname):
        for f in files:
            if f.endswith(EXTENSIONS):
                fp = os.path.join(root, f)
                try:
                    with open(fp, encoding="utf-8") as fh:
                        fh.read()
                except UnicodeDecodeError:
                    BAD.append((fp, "Not valid UTF-8"))
                except Exception as e:
                    BAD.append((fp, str(e)))

if BAD:
    print("ENCODING ERRORS:")
    for b in BAD:
        print(f"  {b[0]}: {b[1]}")
    sys.exit(1)
print("All files UTF-8 clean")
