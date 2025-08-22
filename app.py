import os
import re

# Screen dimensions
SCREEN_WIDTH = 1920
SCREEN_HEIGHT = 1080

# Conversion factors
VW_TO_PX = SCREEN_WIDTH / 100   # 19.2
VH_TO_PX = SCREEN_HEIGHT / 100  # 10.8

def vw_to_vh(value):
    """Convert vw value into vh"""
    px = float(value) * VW_TO_PX
    return px / VH_TO_PX

def convert_units(content):
    """
    Replace vw with vh (via px conversion) and vh with vh (recalculated for consistency).
    """
    # Replace vw → vh
    content = re.sub(
        r"(\d*\.?\d+)vw",
        lambda m: f"{vw_to_vh(m.group(1)):.2f}vh",
        content,
    )

    # Normalize vh (optional: keeps format consistent)
    content = re.sub(
        r"(\d*\.?\d+)vh",
        lambda m: f"{float(m.group(1)):.2f}vh",
        content,
    )

    return content


def scan_and_convert(directory):
    """
    Walk through the directory, find matching files, and replace units.
    """
    FILE_EXTENSIONS = [".scss", ".tsx"]

    for root, _, files in os.walk(directory):
        for file in files:
            if any(file.endswith(ext) for ext in FILE_EXTENSIONS):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()

                new_content = convert_units(content)

                if new_content != content:
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    print(f"Updated: {filepath}")

if __name__ == "__main__":
    project_dir = "F:/Summit/server-data/resources/[summit]/summit_phone/resources/web"  # change this to your project path
    scan_and_convert(project_dir)
    print("✅ Conversion complete!")
