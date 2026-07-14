import { GoogleGenAI } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GrammarExampleService {
  private client: GoogleGenAI;

  constructor(private readonly prisma: PrismaService) {
    this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  async generateExample(grammarPoint: string, level?: string) {
    const cached = await this.prisma.grammarExampleCache.findUnique({
      where: { patternName: grammarPoint },
    });

    if (cached) {
      return (cached.examples as any)[0]; // Simplification for demo
    }

    // Cache miss: Generate via Gemini
    const response = await this.client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `Generate 3 Japanese grammar examples for: ${grammarPoint}. Return as JSON with japanese, translation.`,
    });

    const examples = JSON.parse(response.text || '[]');
    
    // Save to cache
    await this.prisma.grammarExampleCache.create({
      data: {
        patternName: grammarPoint,
        level: level ? parseInt(level, 10) : null,
        examples: JSON.stringify(examples),
      },
    });

    return examples[0];
  }
}
