with open(r"D:\Develop\bili2insight\src\stores\app.ts", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    # Fix ASCII quotes
    lines[i] = line.replace('''"'''', "「").replace('''"''', "」")
    # Fix corrupted ending
    if """.join(\\n")oin(\\n");""" in lines[i]:
        lines[i] = lines[i].replace(""".join(\\n")oin(\\n");""", """].join(\\n")""")
        print(f"Fixed corrupted ending at line {i+1}")

with open(r"D:\Develop\bili2insight\src\stores\app.ts", "w", encoding="utf-8") as f:
    f.writelines(lines)
print("Done")