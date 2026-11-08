// Drop-in replacement for the generateContent part of handleChat() in server.mjs.
// Loads the character guide as a system instruction, sends conversation history,
// and asks Gemini for a strict JSON shape.
import { readFile } from 'node:fs/promises';

const characterGuide = await readFile(new URL('./casey_character.md', import.meta.url), 'utf8');

// history: [{ role: 'user' | 'model', text: '...' }, ...]  (kept per session by the client)
export async function askCasey(ai, model, history, prompt, context) {
  const contents = [
    ...history.slice(-6).map(turn => ({
      role: turn.role,
      parts: [{ text: turn.text }]
    })),
    { role: 'user', parts: [{ text: `Context: ${context}\n\nUser says: ${prompt}` }] }
  ];

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: characterGuide,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          tone: { type: 'STRING', enum: ['normal', 'excited', 'sad', 'fast'] }
        },
        required: ['text', 'tone']
      },
      temperature: 0.9,
      maxOutputTokens: 150
    }
  });

  return JSON.parse(response.text);
}
