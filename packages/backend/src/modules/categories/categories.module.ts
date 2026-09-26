import { Module, OnModuleInit } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { CategorizationEngineService } from './categorization.service';
import { AutoCategorizationService } from './auto-categorization.service';

@Module({
  providers: [CategoriesService, CategorizationEngineService, AutoCategorizationService],
  controllers: [CategoriesController],
  exports: [CategoriesService, AutoCategorizationService],
})
export class CategoriesModule implements OnModuleInit {
  constructor(private categoriesService: CategoriesService) {}

  async onModuleInit() {
    await this.categoriesService.seedDefaults();
  }
}
