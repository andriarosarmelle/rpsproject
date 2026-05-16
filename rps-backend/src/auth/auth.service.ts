import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import bcryptModule from 'bcrypt';
import { Repository } from 'typeorm';
import { getAllowedAdminEmails, isRegistrationAllowed } from './admin-access.config';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { User } from './user.entity';

const bcrypt = bcryptModule as unknown as {
  compare(data: string, encrypted: string): Promise<boolean>;
  hash(data: string, saltOrRounds: number): Promise<string>;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hasUsablePasswordHash(password: string | null | undefined) {
  return typeof password === 'string' && /^\$2[aby]\$\d{2}\$/.test(password);
}

@Injectable()
export class AuthService {
  constructor(
    @Optional()
    @InjectRepository(User)
    private readonly userRepository: Repository<User> | null,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const normalizedEmail = normalizeEmail(registerDto.email);

    // Check if registration is allowed for this email
    const allowedAdminEmails = getAllowedAdminEmails();
    const isExplicitlyAllowed = allowedAdminEmails.includes(normalizedEmail);
    const isDomainAllowed = isRegistrationAllowed(normalizedEmail);

    if (!isExplicitlyAllowed && !isDomainAllowed) {
      throw new ForbiddenException(
        "L'inscription est réservée aux administrateurs autorisés.",
      );
    }

    const existingUser = await this.userRepository?.findOne({
      where: { email: normalizedEmail },
    });

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    if (existingUser) {
      if (hasUsablePasswordHash(existingUser.password)) {
        throw new ConflictException('Email already exists');
      }

      existingUser.name = registerDto.name;
      existingUser.email = normalizedEmail;
      existingUser.password = hashedPassword;

      const activatedUser = await this.userRepository?.save(existingUser);
      const token = this.generateToken(activatedUser!);

      return {
        user: {
          id: activatedUser!.id,
          email: activatedUser!.email,
          name: activatedUser!.name,
        },
        token,
      };
    }

    const user = this.userRepository?.create({
      ...registerDto,
      email: normalizedEmail,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository?.save(user!);
    const token = this.generateToken(savedUser!);

    return {
      user: {
        id: savedUser!.id,
        email: savedUser!.email,
        name: savedUser!.name,
      },
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const normalizedEmail = normalizeEmail(loginDto.email);

    const user = await this.userRepository?.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = user.password
      ? await bcrypt.compare(loginDto.password, user.password)
      : false;

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      token,
    };
  }

  private generateToken(user: User) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
  }

  async validateUser(id: number) {
    const user = await this.userRepository?.findOne({
      where: { id },
      select: ['id', 'email', 'name', 'created_at'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
