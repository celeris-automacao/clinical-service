import { UserContext } from '../../../shared/auth/user-context';
import { CreatePatientUseCase } from '../../application/use-cases/create-patient.use-case';
import { GetPatientByIdUseCase } from '../../application/use-cases/get-patient-by-id.use-case';
import { UpdatePatientProfileUseCase } from '../../application/use-cases/update-patient-profile.use-case';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
export declare class PatientsController {
    private readonly createPatientUseCase;
    private readonly getPatientByIdUseCase;
    private readonly updatePatientProfileUseCase;
    constructor(createPatientUseCase: CreatePatientUseCase, getPatientByIdUseCase: GetPatientByIdUseCase, updatePatientProfileUseCase: UpdatePatientProfileUseCase);
    create(createPatientDto: CreatePatientDto, user: UserContext): Promise<any>;
    findOne(id: string, user: UserContext): Promise<any>;
    updateProfile(id: string, updateProfileDto: UpdatePatientProfileDto, user: UserContext): Promise<any>;
}
