import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IPatientsRepository } from './repositories/interfaces/patients-repository.interface';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

@Injectable()
export class PatientsService {
  constructor(
    @Inject('IPatientsRepository')
    private readonly patientsRepository: IPatientsRepository,
  ) {}

  async create(createPatientDto: CreatePatientDto, tenantId: string) {
    return this.patientsRepository.createWithStats(createPatientDto, tenantId);
  }

  async findOne(id: string) {
    const patient = await this.patientsRepository.findById(id);
    if (!patient) throw new NotFoundException('Paciente não encontrado.');
    return patient;
  }

  async updateProfile(id: string, updateProfileDto: UpdatePatientProfileDto) {
  // Primeiro, verificamos se o paciente existe
  await this.findOne(id); 
  
  // Chamamos o repositório para salvar os dados clínicos
  return this.patientsRepository.updateProfile(id, updateProfileDto);
}
}