import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MisAdaptersModule } from '../../adapters/mis/mis-adapters.module';
import { MisRegistry } from '../../adapters/mis/mis-registry.service';
import { TokenUsage } from '../../database/entities/token-usage.entity';
import { LlmModule } from '../../llm/llm.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogSearch } from '../catalog/catalog-search.service';
import { NluService } from '../nlu/nlu.service';
import { ClinicProfileService } from '../profile/clinic-profile.service';
import { AnswerService } from './answer.service';
import { DialogEngine } from './dialog-engine.service';
import { PipelineChatService } from './pipeline-chat.service';

@Module({
  imports: [LlmModule, CatalogModule, MisAdaptersModule, TypeOrmModule.forFeature([TokenUsage])],
  providers: [
    NluService,
    AnswerService,
    {
      provide: DialogEngine,
      inject: [NluService, AnswerService, CatalogSearch, MisRegistry, ClinicProfileService, getRepositoryToken(TokenUsage)],
      useFactory: (
        nlu: NluService,
        answers: AnswerService,
        search: CatalogSearch,
        mis: MisRegistry,
        profiles: ClinicProfileService,
        usage: Repository<TokenUsage>,
      ) =>
        new DialogEngine({
          nlu,
          answers,
          search,
          adapters: (netId, opts) => mis.forNet(netId, opts),
          profile: (netId) => profiles.forNet(netId),
          onUsage: (session, task, u, promptHash) => {
            usage
              .save({
                clinicNetId: session.clinicNetId,
                sessionId: session.id,
                provider: session.provider,
                promptTokens: u.promptTokens,
                completionTokens: u.completionTokens,
                totalTokens: u.totalTokens,
                task,
                promptHash: promptHash ?? null,
              })
              .catch(() => undefined);
          },
        }),
    },
    PipelineChatService,
  ],
  exports: [PipelineChatService, NluService],
})
export class DialogModule {}
