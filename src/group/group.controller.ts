import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { GroupService } from './group.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { CurrentLearnerDecorator } from '../auth/current-learner.decorator';
import type { CurrentLearner } from '../auth/current-learner.type';

@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  create(
    @CurrentLearnerDecorator() learner: CurrentLearner,
    @Body() createGroupDto: CreateGroupDto,
  ) {
    return this.groupService.create(learner.id, createGroupDto);
  }

  @Get()
  findAll(@CurrentLearnerDecorator() learner: CurrentLearner) {
    return this.groupService.findAll(learner.id);
  }

  @Get(':id')
  findOne(
    @CurrentLearnerDecorator() learner: CurrentLearner,
    @Param('id') id: string,
  ) {
    return this.groupService.findOne(learner.id, id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @CurrentLearnerDecorator() learner: CurrentLearner,
    @Param('id') id: string,
  ) {
    return this.groupService.remove(learner.id, id);
  }

  @Get(':groupId/content')
  getContents(
    @CurrentLearnerDecorator() learner: CurrentLearner,
    @Param('groupId') groupId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.groupService.findContents(learner.id, groupId, page, limit);
  }
}
