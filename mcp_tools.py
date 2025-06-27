import os
import sys
import logging
import requests
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP  

# Configure logging
logger = logging.getLogger('MCPTOOLS')
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Fix UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stderr.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')

# 尝试加载环境变量，处理可能的编码问题
try:
    # 尝试使用不同编码加载.env文件
    for encoding in ['utf-8', 'utf-8-sig', 'latin1', 'cp1252', 'gbk']:
        try:
            logger.info(f"Attempting to load .env with {encoding} encoding")
            load_dotenv(encoding=encoding)
            logger.info("Successfully loaded .env file")
            break
        except Exception as e:
            logger.warning(f"Failed to load .env with {encoding}: {e}")
except Exception as e:
    logger.error(f"Error loading .env: {e}")

# 从环境变量获取API密钥，如果不存在则使用默认值
MAP_API_KEY = os.environ.get("MAP_API_KEY", "66f046533af9f06b10ab1b9c8016b2e1")
logger.info(f"Using MAP_API_KEY: {MAP_API_KEY[:4]}...")

# 初始化MCP实例
try:
    logger.info("Initializing FastMCP...")
    mcp = FastMCP("MCPTOOLS")  # 创建MCP工具注册实例
    logger.info("FastMCP initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize FastMCP: {e}")
    import traceback
    logger.error(traceback.format_exc())
    sys.exit(1)  # MCP初始化失败则退出

# 使用装饰器注册地理编码工具
@mcp.tool()
def geocode(address: str, city: str = "") -> dict:
    """将地址转换为地理坐标。
    
    Args:
        address: 要查询的地址名称
        city: 可选的城市限定参数
        
    Returns:
        包含地理编码结果的字典
    """
    logger.info(f"Geocoding: {address}, city: {city}")
    
    # 直接API调用
    url = "https://restapi.amap.com/v3/geocode/geo"
    params = {
        "address": address,
        "city": city,
        "output": "json",
        "key": MAP_API_KEY
    }
    
    try:
        response = requests.get(url, params=params)
        data = response.json()
        logger.info(f"Geocode API status: {data.get('status')}")
        return data
    except Exception as e:
        logger.error(f"Error calling geocode API: {e}")
        return {"status": "0", "info": str(e)}

# 使用装饰器注册天气查询工具
@mcp.tool()
def get_weather(city: str) -> dict:
    """获取城市的天气信息。
    
    Args:
        city: 要查询天气的城市名称或编码
        
    Returns:
        包含天气信息的字典
    """
    logger.info(f"Getting weather for: {city}")
    
    # 直接API调用
    url = "https://restapi.amap.com/v3/weather/weatherInfo"
    params = {
        "city": city,
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
# 这些只是转发函数，API服务器会调用这些函数
geocode_public = geocode
get_weather_public = get_weather

# 测试代码
if __name__ == "__main__":
    print("Testing MCP tools directly...")
    
    # 测试工具函数
    city = "beijing"
    print(f"Testing weather API with city: {city}")
    weather_data = get_weather(city)
    print(f"Weather API response: {weather_data}")
    
    address = "天安门"
    print(f"Testing geocode API with address: {address}")
    geocode_data = geocode(address)
    print(f"Geocode API response: {geocode_data}")
    
    # 如果需要作为MCP服务运行
    # print("Starting MCP server...")
    # mcp.run(transport="stdio")  # 取消注释以启动MCP服务器