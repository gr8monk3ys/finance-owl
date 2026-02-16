import {
  Controller,
  Get,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private marketplaceService: MarketplaceService) {}

  @Get('products')
  getProducts(
    @Query('category') category?: string,
    @Query('sort') sort?: string,
  ) {
    return this.marketplaceService.getProducts(category, sort);
  }

  @Get('products/:id')
  getProductById(@Param('id') id: string) {
    return this.marketplaceService.getProductById(id);
  }

  @Get('recommendations')
  getRecommendations(@CurrentUser('id') userId: string) {
    return this.marketplaceService.getRecommendations(userId);
  }

  @Post('products/:id/click')
  trackClick(
    @CurrentUser('id') userId: string,
    @Param('id') productId: string,
  ) {
    return this.marketplaceService.trackClick(userId, productId);
  }

  @Get('popular')
  getPopular() {
    return this.marketplaceService.getPopular();
  }
}
