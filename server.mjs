import 'dotenv/config';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { askCasey } from './gemini_server_snippet.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 3000;
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ttf': 'font/ttf'
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20000) {
        req.destroy();
        reject(new Error('Request body is too large.'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function getWeather(context) {
  const latitude = Number(context?.latitude);
  const longitude = Number(context?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code',
    forecast_days: '2',
    timezone: 'auto',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh'
  });
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}.`);
    const data = await response.json();
    return {
      latitude,
      longitude,
      temperatureC: data.current?.temperature_2m,
      feelsLikeC: data.current?.apparent_temperature,
      humidity: data.current?.relative_humidity_2m,
      weatherCode: data.current?.weather_code,
      windKmh: data.current?.wind_speed_10m,
      tomorrow: data.daily?.time?.[1] ? {
        date: data.daily.time[1],
        highC: data.daily.temperature_2m_max?.[1],
        lowC: data.daily.temperature_2m_min?.[1],
        weatherCode: data.daily.weather_code?.[1]
      } : null
    };
  } catch (error) {
    console.error('Weather request failed:', error);
    return null;
  }
}

async function handleChat(req, res) {
  if (!ai) {
    sendJson(res, 503, { error: 'Gemini is not configured. Set GEMINI_API_KEY and restart Casey.' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (error) {
    sendJson(res, 400, { error: 'Request must contain valid JSON.' });
    return;
  }

  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
  if (!prompt || prompt.length > 4000) {
    sendJson(res, 400, { error: 'Prompt must be between 1 and 4000 characters.' });
    return;
  }

  try {
    const weather = await getWeather(payload.context);
    const context = [
      `The user's local time is ${payload.context?.localTime || 'unknown'}.`,
      `Their timezone is ${payload.context?.timeZone || 'unknown'}.`,
      weather
        ? `Their current weather near latitude ${weather.latitude}, longitude ${weather.longitude} is ${JSON.stringify(weather)}.`
        : 'Current weather is unavailable because the user did not share a location.'
    ].join(' ');
    const result = await askCasey(ai, model, [], prompt, context);
    const text = typeof result.text === 'string' ? result.text.trim() : '';
    const tone = ['normal', 'excited', 'sad', 'fast'].includes(result.tone) ? result.tone : 'normal';
    if (!text) {
      sendJson(res, 502, { error: 'Gemini returned an empty response.' });
      return;
    }
    sendJson(res, 200, { text, tone });
  } catch (error) {
    console.error('Gemini request failed:', error);
    const message = error instanceof SyntaxError
      ? 'Gemini returned an invalid response. Please try again.'
      : error.message || 'Gemini request failed.';
    sendJson(res, 502, { error: message });
  }
}

async function serveFile(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = normalize(join(root, requested));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream'
    });
    createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Static file request failed:', error);
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      await handleChat(req, res);
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'API route not found.' });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end('Method not allowed');
      return;
    }
    await serveFile(req, res, url.pathname);
  } catch (error) {
    console.error('Request failed:', error);
    if (!res.headersSent) sendJson(res, 500, { error: 'Casey server failed to process the request.' });
    else res.destroy(error);
  }
});

server.listen(port, () => {
  console.log(`Casey is running at http://localhost:${port}`);
  if (!apiKey) console.warn('GEMINI_API_KEY is not set; chat requests will be unavailable.');
});
