import { Module, OnModuleInit } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';

@Module({
  providers: [CategoriesService],
  controllers: [CategoriesController],
  exports: [CategoriesService],
})
export class CategoriesModule implements OnModuleInit {
  constructor(private categoriesService: CategoriesService) {}

  async onModuleInit() {
    await this.categoriesService.seedDefaults();
  }
}
