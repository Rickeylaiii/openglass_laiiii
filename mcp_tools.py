import os
import sys
import logging
import requests
import re  # 导入正则表达式模块
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# Configure logging
logger = logging.getLogger('MCPTOOLS')
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Fix UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stderr.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')

# 尝试加载环境变量
try:
    load_dotenv()
    logger.info("Successfully loaded .env file")
except Exception as e:
    logger.error(f"Error loading .env: {e}")

# 从环境变量获取API密钥
MAP_API_KEY = os.environ.get("MAP_API_KEY", "")
GROQ_API_KEY = os.environ.get("EXPO_PUBLIC_GROQ_API_KEY", "") # 新增：获取Groq API Key

if not MAP_API_KEY:
    logger.warning("MAP_API_KEY not found in .env file.")
if not GROQ_API_KEY:
    logger.warning("EXPO_PUBLIC_GROQ_API_KEY not found in .env file.")

logger.info(f"Using MAP_API_KEY: {MAP_API_KEY[:4]}...")
logger.info(f"Using GROQ_API_KEY: {GROQ_API_KEY[:7]}...")

# 初始化MCP实例
try:
    logger.info("Initializing FastMCP...")
    mcp = FastMCP("MCPTOOLS")
    logger.info("FastMCP initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize FastMCP: {e}")
    import traceback
    logger.error(traceback.format_exc())
    sys.exit(1)

# --- 新增：城市名翻译函数 ---
def _translate_city_to_chinese(city_name: str) -> str:
    """使用Groq Llama3将英文城市名翻译成中文"""
    if not GROQ_API_KEY:
        logger.error("Groq API key is not configured. Cannot translate city name.")
        return city_name # 如果没有key，返回原名

    logger.info(f"Translating city name '{city_name}' to Chinese...")
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama3-70b-8192",
                "messages": [
                    {"role": "system", "content": "You are a translation assistant. Translate the given city name to Chinese. Return only the Chinese name itself, without any explanation or additional text. For example, if the input is 'Beijing', the output should be '北京'."},
                    {"role": "user", "content": city_name},
                ],
            },
            timeout=10 # 设置10秒超时
        )
        response.raise_for_status() # 如果请求失败则抛出异常
        data = response.json()
        translated_name = data['choices'][0]['message']['content'].strip()
        logger.info(f"Successfully translated '{city_name}' to '{translated_name}'")
        return translated_name
    except Exception as e:
        logger.error(f"Error translating city name '{city_name}': {e}")
        return city_name # 翻译失败，返回原名

# 使用装饰器注册地理编码工具
@mcp.tool()
def geocode(address: str, city: str = "") -> dict:
    """将地址转换为地理坐标。"""
    logger.info(f"Geocoding: {address}, city: {city}")
    url = "https://restapi.amap.com/v3/geocode/geo"
    params = {"address": address, "city": city, "output": "json", "key": MAP_API_KEY}
    try:
        response = requests.get(url, params=params)
        data = response.json()
        logger.info(f"Geocode API status: {data.get('status')}")
        return data
    except Exception as e:
        logger.error(f"Error calling geocode API: {e}")
        return {"status": "0", "info": str(e)}

# --- 修改：天气查询工具 ---
@mcp.tool()
def get_weather(city: str) -> dict:
    """获取城市的天气信息。"""
    processed_city = city.strip()
    
    # 检查是否包含英文字母，如果是则尝试翻译
    if re.search('[a-zA-Z]', processed_city):
        processed_city = _translate_city_to_chinese(processed_city)

    logger.info(f"Getting weather for: {processed_city} (Original: {city})")
    
    url = "https://restapi.amap.com/v3/weather/weatherInfo"
    params = {
        "city": processed_city,
        "key": MAP_API_KEY,
        "output": "json",
        "extensions": "base"
    }
    
    try:
        response = requests.get(url, params=params)
        data = response.json()
        logger.info(f"Weather API status: {data.get('status')}")
        return data
    except Exception as e:
        logger.error(f"Error calling weather API: {e}")
        return {"status": "0", "info": str(e)}

# 为API服务器提供公开函数
geocode_public = geocode
get_weather_public = get_weather

# 测试代码
if __name__ == "__main__":
    logger.info("Starting MCP server...")
    mcp.run(transport="stdio") 