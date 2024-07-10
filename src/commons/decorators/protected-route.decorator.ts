import { SetMetadata } from '@nestjs/common';

export const ProtectedRoute = () => SetMetadata('isPublicRoute', false);
