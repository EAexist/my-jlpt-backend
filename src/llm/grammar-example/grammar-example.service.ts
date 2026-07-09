import { GoogleGenAI } from '@google/genai';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GrammarExampleService {
  private client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  async generateExample(grammarPoint: string) {
    // Gemini grammar-example generation boundary: START
    const response = await this.client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `Generate a Japanese grammar example for: ${grammarPoint}`,
    });
    // Gemini grammar-example generation boundary: END
    return response.text;
  }
}
