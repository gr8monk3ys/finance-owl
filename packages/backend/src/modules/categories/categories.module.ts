import { Module, OnModuleInit } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { LayaCategorizerService } from './laya-categorizer.service';

@Module({
  providers: [CategoriesService, LayaCategorizerService],
  controllers: [CategoriesController],
  exports: [CategoriesService, LayaCategorizerService],
})
export class CategoriesModule implements OnModuleInit {
  constructor(private categoriesService: CategoriesService) {}

  async onModuleInit() {
    await this.categoriesService.seedDefaults();
  }
}
