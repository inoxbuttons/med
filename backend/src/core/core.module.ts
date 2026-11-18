import { Global, Module } from '@nestjs/common';
import { ClinicProfileService } from './profile/clinic-profile.service';
import { PromptBuilder } from './prompts/prompt-builder.service';

/** Профили сетей и сборка промптов — доступны всем модулям. */
@Global()
@Module({
  providers: [
    { provide: ClinicProfileService, useFactory: () => new ClinicProfileService() },
    { provide: PromptBuilder, useFactory: (p: ClinicProfileService) => new PromptBuilder(p), inject: [ClinicProfileService] },
  ],
  exports: [ClinicProfileService, PromptBuilder],
})
export class CoreModule {}
