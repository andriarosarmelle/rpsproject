import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateCampaignParticipantDto {
  @ApiProperty({ description: 'Identifiant unique de la campagne', example: 1 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  campaign_id: number;

  @ApiProperty({ description: "Identifiant unique de l'employe", example: 1 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  employee_id: number;

  @ApiProperty({ description: "Date d'envoi de l'invitation", required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  invitation_sent_at?: Date;
}

export class UpdateCampaignParticipantDto {
  @ApiProperty({ description: "Date d'envoi de l'invitation", required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  invitation_sent_at?: Date | null;

  @ApiProperty({ description: "Date d'envoi du rappel", required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  reminder_sent_at?: Date | null;

  @ApiProperty({
    description: 'Date de completion du sondage',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  completed_at?: Date | null;
}

export class SubmitCampaignResponseItemDto {
  @ApiProperty({ description: 'Identifiant unique de la question', example: 1 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  question_id: number;

  @ApiProperty({ description: 'Reponse a la question', example: 'Ma reponse' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  @IsNotEmpty()
  answer: string;
}

export class SubmitCampaignResponsesDto {
  @ApiProperty({
    description: 'Liste des reponses au sondage',
    type: [SubmitCampaignResponseItemDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SubmitCampaignResponseItemDto)
  responses: SubmitCampaignResponseItemDto[];
}

export class ImportCampaignEmployeeRowDto {
  @ApiProperty({
    description: "Adresse email de l'employe",
    example: 'jean.dupont@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ description: "Prenom de l'employe", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;

  @ApiProperty({ description: "Nom de famille de l'employe", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string;

  @ApiProperty({ description: 'Numero de telephone', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiProperty({ description: "Statut de l'employe", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiProperty({ description: "Departement de l'employe", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiProperty({ description: "Nom de l'entreprise", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  company_name?: string;
}

export class ImportCampaignEmployeesDto {
  @ApiProperty({
    description: "Identifiant unique de l'entreprise",
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  company_id: number;

  @ApiProperty({
    description: 'Liste des employes a importer',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ImportCampaignEmployeeRowDto)
  rows?: ImportCampaignEmployeeRowDto[];

  @ApiProperty({
    description: 'Contenu CSV des employes a importer',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  csv?: string;

  @ApiProperty({ description: "Date d'envoi de l'invitation", required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  invitation_sent_at?: Date;
}

export class SendCampaignRemindersDto {
  @ApiProperty({
    description: "Nombre minimum de jours depuis l'invitation",
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minimum_days_since_invitation?: number;

  @ApiProperty({ description: "Forcer l'envoi des rappels", required: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class SendCampaignInvitationsDto {
  @ApiProperty({
    description: "URL publique de l'application pour construire les liens",
    example: 'http://localhost:3001',
    required: false,
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  app_url?: string;

  @ApiProperty({
    description: 'Forcer un nouvel envoi meme si une invitation existe deja',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
