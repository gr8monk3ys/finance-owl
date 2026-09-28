import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';

@Module({
  imports: [CategoriesModule],
  providers: [ImportService],
  controllers: [ImportController],
  exports: [ImportService],
})
export class ImportModule {}
