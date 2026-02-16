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
import { HouseholdsService } from './households.service';
import { IsString, IsOptional, IsIn } from 'class-validator';

class CreateHouseholdDto {
  @IsString()
  name!: string;
}

class JoinHouseholdDto {
  @IsString()
  inviteCode!: string;
}

class UpdateHouseholdNameDto {
  @IsString()
  name!: string;
}

class UpdateMemberRoleDto {
  @IsString()
  @IsIn(['editor', 'viewer'])
  role!: 'owner' | 'editor' | 'viewer';
}

@Controller('households')
export class HouseholdsController {
  constructor(private householdsService: HouseholdsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateHouseholdDto) {
    return this.householdsService.create(userId, dto.name);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.householdsService.findUserHouseholds(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.householdsService.findOne(userId, id);
  }

  @Patch(':id')
  updateName(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHouseholdNameDto,
  ) {
    return this.householdsService.updateName(userId, id, dto.name);
  }

  @Post(':id/invite-code')
  generateInviteCode(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.householdsService.generateInviteCode(userId, id);
  }

  @Post('join')
  join(@CurrentUser('id') userId: string, @Body() dto: JoinHouseholdDto) {
    return this.householdsService.joinByInviteCode(userId, dto.inviteCode);
  }

  @Patch(':id/members/:memberId/role')
  updateMemberRole(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.householdsService.updateMemberRole(
      userId,
      id,
      memberId,
      dto.role,
    );
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    await this.householdsService.removeMember(userId, id, memberId);
  }

  @Post(':id/accounts/:accountId/share')
  shareAccount(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('accountId') accountId: string,
  ) {
    return this.householdsService.shareAccount(userId, id, accountId);
  }

  @Delete(':id/accounts/:accountId/share')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unshareAccount(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('accountId') accountId: string,
  ) {
    await this.householdsService.unshareAccount(userId, id, accountId);
  }

  @Get(':id/accounts')
  getSharedAccounts(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.householdsService.getSharedAccounts(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteHousehold(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.householdsService.delete(userId, id);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.householdsService.leave(userId, id);
  }
}
