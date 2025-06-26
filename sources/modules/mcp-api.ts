// filepath: d:\git_ck\openglass_laiii\openglass_laiii_618\openglass_laiii_1\sources\modules\mcp-api.ts
import axios from 'axios';

// API服务器地址
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * 获取指定城市的天气信息
 * @param city 城市名称或城市编码
 * @returns 天气信息
 */
export async function getWeather(city: string): Promise<any> {
  try {
    console.log(`Requesting weather for city: ${city}`);
    const response = await axios.get(`${API_BASE_URL}/weather`, {
      params: { city }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return { 
      status: '0', 
      info: error instanceof Error ? error.message : 'Failed to fetch weather data'
    };
  }
}

/**
 * 将地址转换为地理坐标
 * @param address 地址
 * @param city 可选的城市名称
 * @returns 地理编码信息
 */
export async function geocodeAddress(address: string, city: string = ''): Promise<any> {
  try {
    console.log(`Geocoding address: ${address}, city: ${city}`);
    const response = await axios.get(`${API_BASE_URL}/geocode`, {
      params: { address, city }
    });
    return response.data;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return { 
      status: '0', 
      info: error instanceof Error ? error.message : 'Failed to geocode address'
    };
  }
}