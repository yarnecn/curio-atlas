import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ContentRepositoryError } from '@knowledge-map/database';

export function throwRepositoryError(error: unknown): never {
  if (!(error instanceof ContentRepositoryError)) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      throw new ConflictException('相同标识的内容已经存在。');
    }
    throw error;
  }
  if (error.code === 'not_found') throw new NotFoundException(error.message);
  if (error.code === 'unauthorized') throw new UnauthorizedException(error.message);
  if (error.code === 'forbidden') throw new ForbiddenException(error.message);
  if (error.code === 'conflict' || error.code === 'invalid_state') throw new ConflictException(error.message);
  throw new BadRequestException(error.message);
}
