import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import {
  CreateQuestionDto,
  ReorderQuestionDto,
  UpdateQuestionDto,
} from './dto/question.dto';
import { QuestionService } from './question.service';
import { AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@ApiBearerAuth()
@Controller('questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Post()
  @ApiBody({ type: CreateQuestionDto })
  @ApiResponse({ status: 201, description: 'Question créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() createQuestionDto: CreateQuestionDto) {
    return this.questionService.create(createQuestionDto);
  }

  @Get()
  findAll() {
    return this.questionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.questionService.findOne(id);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateQuestionDto })
  @ApiResponse({ status: 200, description: 'Question mise à jour avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ) {
    return this.questionService.update(id, updateQuestionDto);
  }

  @Patch('campaign/:campaignId/reorder')
  @ApiBody({ type: [ReorderQuestionDto] })
  @ApiResponse({
    status: 200,
    description: 'Questions réordonnées avec succès',
  })
  reorder(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() items: ReorderQuestionDto[],
  ) {
    return this.questionService.reorder(campaignId, items);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.questionService.remove(id);
  }
}
