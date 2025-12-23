import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('club_config')
export class ClubConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true, name: 'whatsapp_link' })
  whatsappLink: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'next_meeting_datetime' })
  nextMeetingDateTime: Date | null;

  @Column({ type: 'varchar', nullable: true, name: 'meeting_link' })
  meetingLink: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

