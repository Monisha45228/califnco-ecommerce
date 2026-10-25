import os
import zipfile
import shutil

source_dir = r"C:\Users\Monisha J\.gemini\antigravity\scratch\califnco-ecommerce"
output_zip1 = r"C:\Users\Monisha J\.gemini\antigravity\scratch\califnco-ecommerce.zip"
output_zip2 = r"C:\Users\Monisha J\Desktop\califnco-ecommerce.zip"

exclude_dirs = {"node_modules", ".git", "__pycache__"}

print("Creating clean zip archive (excluding heavy node_modules)...")

with zipfile.ZipFile(output_zip1, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(source_dir):
        # Modify dirs in-place to avoid walking into excluded folders
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, os.path.dirname(source_dir))
            zipf.write(file_path, arcname)

shutil.copy2(output_zip1, output_zip2)

size_mb = os.path.getsize(output_zip1) / (1024 * 1024)
print(f"Zip created successfully!")
print(f"Path 1: {output_zip1} ({size_mb:.2f} MB)")
print(f"Path 2 (Desktop): {output_zip2} ({size_mb:.2f} MB)")
