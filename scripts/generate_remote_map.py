import os
import json
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

# ================= 核心配置 =================
# 1. 本地原图的路径 (用来提取 GPS)
LOCAL_IMAGE_DIR = "photo/" 

# 2. 你的图床前缀
# 脚本会自动拼接: REMOTE_URL_PREFIX + 文件名
REMOTE_URL_PREFIX = "https://img.junren.li/"

# 3. 输出文件
OUTPUT_FILE = "static/data/life_points.json"
# ===========================================

def get_exif_data(image):
    """提取图片 EXIF"""
    exif_data = {}
    try:
        info = image._getexif()
        if info:
            for tag, value in info.items():
                decoded = TAGS.get(tag, tag)
                if decoded == "GPSInfo":
                    gps_data = {}
                    for t in value:
                        sub_decoded = GPSTAGS.get(t, t)
                        gps_data[sub_decoded] = value[t]
                    exif_data[decoded] = gps_data
                else:
                    exif_data[decoded] = value
    except Exception:
        pass
    return exif_data

def convert_to_degrees(value):
    """DMS 转 十进制"""
    d = float(value[0])
    m = float(value[1])
    s = float(value[2])
    return d + (m / 60.0) + (s / 3600.0)

def get_lat_lon(exif_data):
    """计算经纬度"""
    gps_info = exif_data.get("GPSInfo")
    if not gps_info:
        return None, None

    gps_lat = gps_info.get("GPSLatitude")
    gps_lat_ref = gps_info.get("GPSLatitudeRef")
    gps_lon = gps_info.get("GPSLongitude")
    gps_lon_ref = gps_info.get("GPSLongitudeRef")

    if gps_lat and gps_lat_ref and gps_lon and gps_lon_ref:
        lat = convert_to_degrees(gps_lat)
        if gps_lat_ref != "N": lat = -lat
        lon = convert_to_degrees(gps_lon)
        if gps_lon_ref != "E": lon = -lon
        return lat, lon
    return None, None

def main():
    points = []
    
    # 支持的图片扩展名
    valid_exts = ('.jpg', '.jpeg', '.png', '.webp', '.heic')
    
    print(f"Scanning local images in: {LOCAL_IMAGE_DIR}...")
    
    for filename in os.listdir(LOCAL_IMAGE_DIR):
        if filename.lower().endswith(valid_exts):
            full_path = os.path.join(LOCAL_IMAGE_DIR, filename)
            
            try:
                img = Image.open(full_path)
                exif = get_exif_data(img)
                lat, lon = get_lat_lon(exif)
                
                if lat and lon:
                    # 获取日期作为标题
                    date_str = exif.get("DateTimeOriginal", "Unknown Date")
                    
                    # === 关键步骤：生成远程 URL ===
                    # 假设图床的文件名和本地一致，只是多了前缀
                    # 如果图床有文件夹结构（如 2024/01/a.jpg），这里需要自己调整逻辑
                    remote_url = REMOTE_URL_PREFIX + filename
                    
                    points.append({
                        "lat": round(lat, 6), # 保留6位小数够用了
                        "lng": round(lon, 6),
                        "title": f"{date_str}",
                        "img": remote_url
                    })
                    print(f"[Link] {filename} -> GPS Found")
                else:
                    print(f"[Skip] {filename} -> No GPS")
            
            except Exception as e:
                print(f"[Error] {filename}: {e}")

    # 导出 JSON
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(points, f, indent=4, ensure_ascii=False)
    
    print(f"\nSuccess! Generated {len(points)} points in {OUTPUT_FILE}")

if __name__ == "__main__":
    main()