import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingIndexerService } from './embedding-indexer.service';
import { EmbeddingQueueService } from './embedding-queue.service';
import { EmbeddingProcessor } from './embedding.processor';
import { EMBEDDING_QUEUE } from './search.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: EMBEDDING_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }),
  ],
  controllers: [SearchController],
  providers: [
    SearchService,
    EmbeddingsService,
    EmbeddingIndexerService,
    EmbeddingQueueService,
    EmbeddingProcessor,
  ],
})
export class SearchModule {}
