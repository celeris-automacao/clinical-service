import { Inject, Injectable } from '@nestjs/common';
import { RecordsRepositoryPort } from '../../../records/application/ports/records-repository.port';
import { RECORDS_REPOSITORY } from '../../../records/records.tokens';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
import { TASKS_REPOSITORY } from '../../tasks.tokens';

@Injectable()
export class GetCategorizedRankingUseCase {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly repository: TasksRepositoryPort,
    @Inject(RECORDS_REPOSITORY)
    private readonly recordsRepository: RecordsRepositoryPort,
  ) {}

  async execute(tenantId: string) {
    const [patients, clinicalDamageMap] = await Promise.all([
      this.repository.findPatientsWithActivity(tenantId),
      this.recordsRepository.getClinicalDamageByTenant(tenantId),
    ]);

    return patients
      .map((patient) => {
        const missionDamage = patient.completions.reduce(
          (acc, completion) => acc + (completion.task?.xpReward || 0),
          0,
        );
        const clinicalDamage = clinicalDamageMap.get(patient.id) || 0;
        const totalDamage = missionDamage + clinicalDamage;

        return {
          name: patient.name,
          missionRank: missionDamage,
          clinicalRank: clinicalDamage,
          totalDamage,
          level: Math.floor(Math.sqrt(totalDamage / 500)) + 1,
        };
      })
      .sort((a, b) => b.totalDamage - a.totalDamage);
  }
}
