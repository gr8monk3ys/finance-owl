import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { AssetsService } from './assets.service';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
  CreateVehicleDto,
  UpdateVehicleDto,
} from './dto';

@Controller('assets')
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  // ─── Summary ─────────────────────────────────────────────────────

  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.assetsService.getAssetSummary(userId);
  }

  @Get('net-worth-contribution')
  getNetWorthContribution(@CurrentUser('id') userId: string) {
    return this.assetsService.getNetWorthContribution(userId);
  }

  // ─── Value History ───────────────────────────────────────────────

  @Get('value-history/:type/:id')
  getValueHistory(
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.assetsService.getValueHistory(type, id);
  }

  // ─── Properties ──────────────────────────────────────────────────

  @Get('properties')
  findAllProperties(@CurrentUser('id') userId: string) {
    return this.assetsService.findAllProperties(userId);
  }

  @Get('properties/:id')
  findOneProperty(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.assetsService.findPropertyById(userId, id);
  }

  @Post('properties')
  createProperty(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.assetsService.createProperty(userId, dto);
  }

  @Patch('properties/:id')
  updateProperty(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.assetsService.updateProperty(userId, id, dto);
  }

  @Delete('properties/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeProperty(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.assetsService.removeProperty(userId, id);
  }

  @Post('properties/:id/estimate')
  estimatePropertyValue(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.assetsService.estimatePropertyValue(userId, id);
  }

  // ─── Vehicles ────────────────────────────────────────────────────

  @Get('vehicles')
  findAllVehicles(@CurrentUser('id') userId: string) {
    return this.assetsService.findAllVehicles(userId);
  }

  @Get('vehicles/:id')
  findOneVehicle(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.assetsService.findVehicleById(userId, id);
  }

  @Post('vehicles')
  createVehicle(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.assetsService.createVehicle(userId, dto);
  }

  @Patch('vehicles/:id')
  updateVehicle(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.assetsService.updateVehicle(userId, id, dto);
  }

  @Delete('vehicles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeVehicle(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.assetsService.removeVehicle(userId, id);
  }

  @Post('vehicles/:id/estimate')
  estimateVehicleValue(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.assetsService.estimateVehicleValue(userId, id);
  }
}
