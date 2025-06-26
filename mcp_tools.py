import requests
import logging
import sys
import os

# Configure logging
logger = logging.getLogger('MCPTOOLS')
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Fix UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stderr.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')


MAP_API_KEY = "..."

def geocode(address: str, city: str = "") -> dict:
    """Convert address to geographic coordinates using Amap API."""
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

def get_weather(city: str) -> dict:
    """Get weather information for a city using Amap API."""
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

# 测试代码
if __name__ == "__main__":
    city = "beijing"
    print(f"Testing weather API with city: {city}")
    weather_data = get_weather(city)
    print(f"Weather API response: {weather_data}")
    
    address = "天安门"
    print(f"Testing geocode API with address: {address}")
    geocode_data = geocode(address)
    print(f"Geocode API response: {geocode_data}")