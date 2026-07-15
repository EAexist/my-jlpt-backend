import { Injectable } from '@nestjs/common';
import { Content as ContentEntity } from '../generated/prisma';

export interface BaseContent {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  title: string;
  groupId: string;
  input_text: string | null;
  created_at: Date;
}

export interface ProcessingContent extends BaseContent {
  status: 'PENDING' | 'PROCESSING';
}

export interface FailedContent extends BaseContent {
  status: 'FAILED';
  error_message: string;
}

export interface CompletedContent extends BaseContent {
  status: 'COMPLETED';
  overall_level: 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
  sentences: any[]; // Maps to SentenceSchema
  vocabulary: any[]; // Maps to VocabularyItemSchema
}

@Injectable()
export class ContentPresenter {
  mapToResponse(
    content: ContentEntity & {
      sentenceAnalyses?: any[];
      vocabularyItems?: any[];
    },
  ): BaseContent | ProcessingContent | FailedContent | CompletedContent {
    const base: BaseContent = {
      id: content.id,
      status: content.status,
      title: content.title,
      groupId: content.groupId,
      input_text: content.inputText,
      created_at: content.createdAt,
    };

    if (content.status === 'FAILED') {
      return {
        ...base,
        status: 'FAILED',
        error_message: content.errorMessage || 'Unknown error',
      };
    }

    if (content.status === 'COMPLETED') {
      return {
        ...base,
        status: 'COMPLETED',
        overall_level: this.mapLevel(content.overallLevel),
        sentences: content.sentenceAnalyses || [],
        vocabulary: content.vocabularyItems || [],
      };
    }

    return {
      ...base,
      status: content.status,
    };
  }

  private mapLevel(level: number | null): 'N1' | 'N2' | 'N3' | 'N4' | 'N5' {
    const levels: Record<number, 'N1' | 'N2' | 'N3' | 'N4' | 'N5'> = {
      1: 'N1',
      2: 'N2',
      3: 'N3',
      4: 'N4',
      5: 'N5',
    };
    return levels[level || 0] || 'N5';
  }
}
