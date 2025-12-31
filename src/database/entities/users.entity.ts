import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  SUPPORT = 'support',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

@Entity('users')
@Check(`"role" IN ('customer', 'admin', 'support')`)
@Check(`"status" IN ('active', 'inactive', 'suspended', 'deleted')`)
@Check(`"email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'`)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, nullable: false })
  email: string;

  @Column({ type: 'varchar', nullable: false, name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string;

  @Column({ type: 'varchar', nullable: true, name: 'country_code' })
  countryCode: string | null;

  @Column({
    type: 'char',
    length: 3,
    default: 'CLP',
    nullable: false,
    name: 'preferred_currency',
  })
  preferredCurrency: string;

  @Column({
    type: 'varchar',
    length: 2,
    default: 'kg',
    nullable: false,
    name: 'preferred_weight_unit',
  })
  preferredWeightUnit: string;

  @Column({
    type: 'varchar',
    default: UserRole.CUSTOMER,
    nullable: false,
  })
  role: UserRole;

  @Column({
    type: 'varchar',
    default: UserStatus.ACTIVE,
    nullable: false,
  })
  status: UserStatus;

  @Column({ type: 'boolean', default: false, nullable: false, name: 'email_verified' })
  emailVerified: boolean;

  @Column({ type: 'varchar', nullable: true, name: 'refresh_token_hash' })
  refreshTokenHash: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_login_at' })
  lastLoginAt: Date;
}

